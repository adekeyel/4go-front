import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import { toast } from "sonner";
import { canMakeVoiceCall, canMakeVideoCall, callPermissionDenialMessage } from "@/lib/callPermissions";
import * as callsApi from "@/api/calls";

export type CallType = "voice" | "video";
export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

/** Where a call is in its life, for the on-screen status line. */
export type CallPhase = "idle" | "incoming" | "calling" | "ringing" | "connecting" | "connected" | "reconnecting";

/** The other person on a 1:1 call. */
export interface CallPeer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface IncomingCall {
  from: string;
  name: string;
  avatarUrl?: string | null;
  type: CallType;
  roomId: string;
  callId: string;
  sdp?: RTCSessionDescriptionInit;
}

export interface RemoteParticipant {
  peerId: string;
  name: string;
  stream: MediaStream | null;
  /** They turned their camera off / muted themselves (told to us over the call signal). */
  cameraOff?: boolean;
  muted?: boolean;
}

interface CallContextValue {
  callState: CallState;
  callType: CallType;
  callRoomId: string | null;
  incomingCall: IncomingCall | null;
  /** Who we're talking to (name + photo), for both outgoing and incoming calls. */
  peer: CallPeer | null;
  /** Finer-grained than callState: calling / ringing / connecting / connected / reconnecting. */
  callPhase: CallPhase;
  /** When media started flowing (ms since epoch); drives the call timer. */
  connectedAt: number | null;
  isFrontCamera: boolean;
  canSwitchCamera: boolean;
  switchCamera: () => Promise<void>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isSpeakerOn: boolean;
  participants: RemoteParticipant[];
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>; // legacy single-peer (1st participant)
  remoteAudioRef: React.RefObject<HTMLAudioElement>; // legacy single-peer
  startCall: (roomId: string, peerId: string, peerName: string, type: CallType, peerAvatarUrl?: string | null) => Promise<void>;
  addParticipant: (peerId: string, peerName: string) => Promise<void>;
  answerCall: () => Promise<void>;
  endCall: () => void;
  rejectCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

// Used only if the backend can't be reached. The backend's /calls/ice-servers adds a TURN relay when one is
// configured, which is what makes calls work between people on mobile data / strict networks.
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// A call that nobody answers stops ringing on the caller's screen after this long (the server marks it missed at 45s).
const CALLER_GIVE_UP_MS = 50_000;
// A brief network drop (wifi <-> mobile data, a tunnel) shouldn't end the call: wait this long before giving up on a peer.
const PEER_RECONNECT_GRACE_MS = 12_000;

// Once both sides have picked up, media must start flowing within this long or we stop and say so,
// instead of leaving a screen stuck on "Connecting…" forever.
const CONNECT_TIMEOUT_MS = 30_000;

const MAX_PARTICIPANTS = 3; // max 4-way (self + 3 others)

// Video quality: 720p at up to 30 fps. The bitrate cap keeps a 1:1 call smooth on ordinary mobile data and is
// lowered when there are several people (each sends a separate stream to every other participant).
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } as const;
const MAX_VIDEO_BITRATE_1TO1 = 1_400_000;
const MAX_VIDEO_BITRATE_GROUP = 600_000;

type WakeLockHandle = { release: () => Promise<void>; addEventListener: (type: "release", cb: () => void) => void };

interface PeerEntry {
  pc: RTCPeerConnection;
  stream: MediaStream;
  name: string;
  pendingCandidates: RTCIceCandidateInit[];
  hasRemoteDesc: boolean;
  /** True when this side created the offer for this peer (only the offerer restarts a broken connection). */
  initiator: boolean;
  restartAttempted: boolean;
  giveUpTimer: number | null;
}

function handleMediaError(err: unknown, type: CallType) {
  const error = err as DOMException;
  if (error.name === "NotAllowedError") {
    toast.error(type === "video" ? "Camera & microphone permission denied." : "Microphone permission denied.");
  } else if (error.name === "NotFoundError") {
    toast.error(type === "video" ? "No camera or microphone found." : "No microphone found.");
  } else if (error.name === "NotReadableError") {
    toast.error("Your microphone or camera is being used by another app.");
  } else {
    toast.error("Failed to access your microphone/camera.");
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const socket = useSocket();
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("voice");
  const [callRoomId, setCallRoomId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [ringingAck, setRingingAck] = useState(false); // caller: the other person's app is reachable and ringing
  const [answered, setAnswered] = useState(false); // someone picked up; waiting for media to flow
  const [reconnecting, setReconnecting] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [remoteMedia, setRemoteMedia] = useState<Record<string, { cameraOff: boolean; muted: boolean }>>({});

  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const groupInvitesRef = useRef<Map<string, string>>(new Map()); // callId -> invited user, for group-call invites
  const callIdRef = useRef<string | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const callTypeRef = useRef<CallType>("voice");
  const callLogIdRef = useRef<string | null>(null);
  const initialPeerIdRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const callRoomIdRef = useRef<string | null>(null);
  const handledCallIdsRef = useRef<Set<string>>(new Set());
  const ringTimeoutRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);
  const roleRef = useRef<"caller" | "callee" | null>(null);
  const peerAnsweredRef = useRef(false); // caller side: the callee has picked up (so don't give up on "no answer")
  // Network candidates from the caller can arrive while the callee's phone is still ringing, before any peer
  // connection exists. They used to be thrown away; now they're kept here until the callee answers.
  const earlyIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { callRoomIdRef.current = callRoomId; }, [callRoomId]);

  const rankRef = useRef<string | null | undefined>(profile?.rank);
  useEffect(() => { rankRef.current = profile?.rank; }, [profile?.rank]);

  // Enforced here (not just in the UI) so nothing — a stale button, a
  // deep-linked /call/:id, or a group "add participant" — can start or
  // accept a call type the current rank isn't allowed to use. The backend
  // (POST /api/calls and the call:invite socket handler) enforces the same
  // rule independently.
  const hasCallPermission = useCallback((type: CallType) => {
    return type === "video" ? canMakeVideoCall(rankRef.current) : canMakeVoiceCall(rankRef.current);
  }, []);

  // ---------- ICE servers (STUN + TURN from the backend) ----------
  const refreshIceServers = useCallback(async () => {
    try {
      const list = await Promise.race([
        callsApi.getIceServers(),
        new Promise<RTCIceServer[]>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 2500)),
      ]);
      if (list.length) iceServersRef.current = list;
    } catch {
      /* keep whatever we had; STUN-only still works on friendly networks */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshIceServers();
    const id = window.setInterval(() => void refreshIceServers(), 6 * 60 * 60 * 1000); // TURN passwords are short-lived
    return () => window.clearInterval(id);
  }, [user, refreshIceServers]);

  // ---------- Ringtone helpers ----------
  const stopRingtone = useCallback(() => {
    const w = window as typeof window & {
      __callRingtone?: HTMLAudioElement;
      __callRingback?: HTMLAudioElement;
      __callVibrateInterval?: number;
    };
    if (w.__callRingtone) { w.__callRingtone.pause(); w.__callRingtone.currentTime = 0; delete w.__callRingtone; }
    if (w.__callRingback) { w.__callRingback.pause(); w.__callRingback.currentTime = 0; delete w.__callRingback; }
    if (w.__callVibrateInterval) {
      clearInterval(w.__callVibrateInterval);
      delete w.__callVibrateInterval;
      try { navigator.vibrate?.(0); } catch { /* ignore */ }
    }
  }, []);

  const playLoopingAudio = useCallback((src: string, key: "__callRingtone" | "__callRingback") => {
    try {
      const w = window as typeof window & Record<string, HTMLAudioElement | undefined>;
      if (w[key]) return;
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = 1;
      const tryPlay = () => audio.play().catch(() => {
        const resume = () => {
          audio.play().catch(() => {});
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      });
      tryPlay();
      w[key] = audio;
    } catch { /* ignore */ }
  }, []);

  const startVibrationLoop = useCallback(() => {
    try {
      const w = window as typeof window & { __callVibrateInterval?: number };
      w.__callVibrateInterval = window.setInterval(() => {
        try { navigator.vibrate?.([600, 400, 600, 400]); } catch { /* ignore */ }
      }, 2000);
    } catch { /* ignore */ }
  }, []);

  const markCallHandled = useCallback((callId?: string | null) => {
    if (!callId) return;
    handledCallIdsRef.current.add(callId);
    window.setTimeout(() => handledCallIdsRef.current.delete(callId), 15 * 60 * 1000);
  }, []);

  const closeCallNotifications = useCallback((roomId?: string | null, callId?: string | null) => {
    const tags = [roomId ? `call-${roomId}` : null, callId ? `call-${callId}` : null].filter(Boolean) as string[];
    if (tags.length === 0 || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.controller?.postMessage({
      type: "CALL_STATE_CHANGED",
      tags,
      suppressTags: callId ? [`call-${callId}`] : [],
      callId,
    });
    void navigator.serviceWorker.ready.then(async (registration) => {
      const reg = registration as ServiceWorkerRegistration & {
        getNotifications?: (filter?: { tag?: string }) => Promise<Notification[]>;
      };
      if (!reg.getNotifications) return;
      await Promise.all(tags.map(async (tag) => {
        const notifications = await reg.getNotifications?.({ tag });
        notifications?.forEach((notification) => notification.close());
      }));
    }).catch(() => {});
  }, []);

  // ---------- Media helpers ----------
  const playMediaElement = useCallback((el: HTMLMediaElement | null) => {
    if (!el) return;
    requestAnimationFrame(() => { el.play().catch(() => {}); });
  }, []);

  const attachLocalStream = useCallback((stream: MediaStream | null) => {
    const el = localVideoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.autoplay = true;
    el.playsInline = true;
    el.muted = true;
    if (stream) playMediaElement(el);
  }, [playMediaElement]);

  const refreshParticipantsState = useCallback(() => {
    const arr: RemoteParticipant[] = [];
    peersRef.current.forEach((entry, peerId) => {
      arr.push({ peerId, name: entry.name, stream: entry.stream });
    });
    setParticipants(arr);

    // Legacy single-peer attach: first remote to remoteVideoRef/remoteAudioRef
    const first = arr[0];
    const audioEl = remoteAudioRef.current;
    const videoEl = remoteVideoRef.current;
    if (audioEl) {
      audioEl.srcObject = first?.stream ?? null;
      audioEl.autoplay = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      if (first?.stream) playMediaElement(audioEl);
    }
    if (videoEl) {
      const hasVideo = !!first?.stream && first.stream.getVideoTracks().length > 0;
      if (hasVideo) {
        videoEl.srcObject = first.stream;
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = true;
        playMediaElement(videoEl);
      } else {
        videoEl.srcObject = null;
      }
    }
  }, [playMediaElement]);

  // Reports that this side hung up. The server decides the final status and measures the duration itself
  // ("cancelled" only means something while the call is still ringing; once answered, any hang-up just ends it).
  const connectedAtRef = useRef<number | null>(null);
  const finalizeCallLog = useCallback(() => {
    if (!callLogIdRef.current) return;
    const connected = callStateRef.current === "connected";
    const status = connected || roleRef.current === "callee" ? "ended" : "cancelled";
    const seconds = connectedAtRef.current ? Math.round((Date.now() - connectedAtRef.current) / 1000) : undefined;
    void callsApi.updateCallStatus(callLogIdRef.current, status, seconds).catch((err) => console.warn("call log update failed", err));
  }, []);

  // ---------- Cleanup ----------
  const cleanup = useCallback(() => {
    stopRingtone();
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (connectTimeoutRef.current) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    const activeCallId = callIdRef.current ?? incomingCallRef.current?.callId;
    const activeRoomId = callRoomIdRef.current ?? incomingCallRef.current?.roomId;
    markCallHandled(activeCallId);
    closeCallNotifications(activeRoomId, activeCallId);
    peersRef.current.forEach((entry) => {
      if (entry.giveUpTimer) window.clearTimeout(entry.giveUpTimer);
      try { entry.pc.close(); } catch { /* ignore */ }
    });
    peersRef.current.clear();
    earlyIceRef.current.clear();
    roleRef.current = null;
    peerAnsweredRef.current = false;
    connectedAtRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    cameraTrackRef.current = null;

    [localVideoRef.current, remoteVideoRef.current, remoteAudioRef.current].forEach((el) => {
      if (!el) return;
      el.pause();
      el.srcObject = null;
    });

    setParticipants([]);
    callStateRef.current = "idle";
    callRoomIdRef.current = null;
    incomingCallRef.current = null;
    setCallState("idle");
    setCallRoomId(null);
    setIncomingCall(null);
    setPeer(null);
    setRingingAck(false);
    setAnswered(false);
    setReconnecting(false);
    setConnectedAt(null);
    setFacing("user");
    setRemoteMedia({});
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setIsSpeakerOn(true);
    callIdRef.current = null;
    callLogIdRef.current = null;
    initialPeerIdRef.current = null;
  }, [stopRingtone, markCallHandled, closeCallNotifications]);

  // ---------- Send a signal over the socket (offer/answer/ice/leave/reject/join-mesh) ----------
  const sendSignal = useCallback((to: string, signal: Record<string, unknown>) => {
    if (!socket || !callIdRef.current) return;
    socket.emit("call:signal", { callId: callIdRef.current, to, signal });
  }, [socket]);

  // Our side is ready and the other side has picked up; if no media flows in time, stop instead of hanging.
  const armConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = window.setTimeout(() => {
      connectTimeoutRef.current = null;
      if (callStateRef.current === "idle" || callStateRef.current === "connected") return;
      toast.error("Couldn't connect the call. Check your connection and try again.");
      peersRef.current.forEach((_entry, peerId) => sendSignal(peerId, { type: "leave" }));
      finalizeCallLog();
      cleanup();
    }, CONNECT_TIMEOUT_MS);
  }, [sendSignal, finalizeCallLog, cleanup]);

  // Media is really flowing: stop ringing, start the timer, clear any "reconnecting" notice.
  const markConnected = useCallback(() => {
    stopRingtone();
    if (connectTimeoutRef.current) { window.clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    if (!connectedAtRef.current) { connectedAtRef.current = Date.now(); setConnectedAt(connectedAtRef.current); }
    setReconnecting(false);
    if (callStateRef.current !== "connected") { callStateRef.current = "connected"; setCallState("connected"); }
  }, [stopRingtone]);

  // Tell the other side(s) whether our mic / camera are on, so they can show "camera off" instead of a frozen frame.
  const broadcastMediaState = useCallback((onlyTo?: string) => {
    const stream = localStreamRef.current;
    const payload = {
      type: "media-state",
      mic: stream?.getAudioTracks()[0]?.enabled !== false,
      camera: stream?.getVideoTracks()[0]?.enabled !== false,
    };
    if (onlyTo) sendSignal(onlyTo, payload);
    else peersRef.current.forEach((_entry, peerId) => sendSignal(peerId, payload));
  }, [sendSignal]);

  // Cap video bitrate / prefer smooth motion once connected.
  const tuneVideoSenders = useCallback((pc: RTCPeerConnection) => {
    const maxBitrate = peersRef.current.size > 1 ? MAX_VIDEO_BITRATE_GROUP : MAX_VIDEO_BITRATE_1TO1;
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind !== "video") return;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings[0].maxBitrate = maxBitrate;
        (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-framerate";
        void sender.setParameters(params).catch(() => {});
      } catch { /* not supported: browser defaults apply */ }
    });
  }, []);

  // ---------- Create a peer entry ----------
  const createPeer = useCallback((peerId: string, name: string, initiator = false): PeerEntry => {
    const existing = peersRef.current.get(peerId);
    if (existing) {
      const local = localStreamRef.current;
      if (local && existing.pc.getSenders().length === 0) {
        local.getTracks().forEach((t) => existing.pc.addTrack(t, local));
      }
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    const stream = new MediaStream();

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, { type: "ice", candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      const entry = peersRef.current.get(peerId);
      if (!entry) return;
      const incoming = e.streams[0];
      if (incoming) {
        entry.stream = incoming;
      } else if (!entry.stream.getTracks().some((t) => t.id === e.track.id)) {
        entry.stream.addTrack(e.track);
      }
      // (Media arriving doesn't mean the connection is up yet; "connected" is set when ICE actually connects.)
      refreshParticipantsState();
    };

    const dropPeer = () => {
      const gone = peersRef.current.get(peerId);
      if (!gone) return;
      if (gone.giveUpTimer) window.clearTimeout(gone.giveUpTimer);
      try { gone.pc.close(); } catch { /* ignore */ }
      peersRef.current.delete(peerId);
      refreshParticipantsState();
      if (peersRef.current.size === 0 && callStateRef.current !== "idle") {
        finalizeCallLog();
        cleanup();
      }
    };

    // The offerer asks the other side to find a new network path (ICE restart): this is what rescues a call
    // when the phone switches between wifi and mobile data.
    const tryIceRestart = async () => {
      const cur = peersRef.current.get(peerId);
      if (!cur || !cur.initiator || cur.restartAttempted) return;
      cur.restartAttempted = true;
      try {
        const offer = await cur.pc.createOffer({ iceRestart: true });
        await cur.pc.setLocalDescription(offer);
        sendSignal(peerId, { type: "offer", sdp: offer, restart: true });
      } catch (err) {
        console.warn("ICE restart failed", err);
      }
    };

    const armGiveUp = () => {
      const cur = peersRef.current.get(peerId);
      if (!cur || cur.giveUpTimer) return;
      cur.giveUpTimer = window.setTimeout(() => {
        cur.giveUpTimer = null;
        const st = cur.pc.connectionState;
        if (st !== "connected") dropPeer();
      }, PEER_RECONNECT_GRACE_MS);
    };

    pc.onconnectionstatechange = () => {
      const cur = peersRef.current.get(peerId);
      if (!cur) return;
      const st = pc.connectionState;
      if (st === "connected") {
        if (cur.giveUpTimer) { window.clearTimeout(cur.giveUpTimer); cur.giveUpTimer = null; }
        cur.restartAttempted = false;
        markConnected();
        tuneVideoSenders(pc);
        broadcastMediaState(peerId);
      } else if (st === "disconnected") {
        // Usually a blink (network handover). Show "Reconnecting…", give it a moment to recover, then try a restart.
        if (callStateRef.current === "connected") setReconnecting(true);
        armGiveUp();
        window.setTimeout(() => { if (pc.connectionState === "disconnected") void tryIceRestart(); }, 3000);
      } else if (st === "failed") {
        if (callStateRef.current === "connected") setReconnecting(true);
        armGiveUp();
        void tryIceRestart();
      } else if (st === "closed") {
        dropPeer();
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") markConnected();
    };

    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

    const entry: PeerEntry = { pc, stream, name, pendingCandidates: [], hasRemoteDesc: false, initiator, restartAttempted: false, giveUpTimer: null };
    // Candidates the other side sent while we were still ringing.
    const early = earlyIceRef.current.get(peerId);
    if (early) { entry.pendingCandidates.push(...early); earlyIceRef.current.delete(peerId); }
    peersRef.current.set(peerId, entry);
    return entry;
  }, [sendSignal, refreshParticipantsState, markConnected, tuneVideoSenders, broadcastMediaState, finalizeCallLog, cleanup]);

  // ---------- Get local media (idempotent) ----------
  const ensureLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current;
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === "video" ? { facingMode: "user", ...VIDEO_CONSTRAINTS } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    stream.getVideoTracks().forEach((t) => { try { t.contentHint = "motion"; } catch { /* ignore */ } });
    attachLocalStream(stream);
    if (type === "video") {
      void navigator.mediaDevices.enumerateDevices().then((d) => setHasMultipleCameras(d.filter((x) => x.kind === "videoinput").length > 1)).catch(() => {});
    }
    return stream;
  }, [attachLocalStream]);

  // Front <-> back camera (phones/tablets). The new camera is swapped into the live call without renegotiating.
  const switchCamera = useCallback(async () => {
    const local = localStreamRef.current;
    if (!local || callTypeRef.current !== "video") return;
    if (screenStreamRef.current) { toast.info("Stop sharing your screen to switch cameras."); return; }
    const next = facing === "user" ? "environment" : "user";
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: next }, ...VIDEO_CONSTRAINTS }, audio: false });
      const newTrack = fresh.getVideoTracks()[0];
      if (!newTrack) return;
      const old = local.getVideoTracks()[0];
      newTrack.enabled = old ? old.enabled : true;
      try { newTrack.contentHint = "motion"; } catch { /* ignore */ }
      peersRef.current.forEach((entry) => {
        const sender = entry.pc.getSenders().find((x) => x.track?.kind === "video");
        if (sender) void sender.replaceTrack(newTrack);
      });
      if (old) { local.removeTrack(old); old.stop(); }
      local.addTrack(newTrack);
      cameraTrackRef.current = newTrack;
      attachLocalStream(local);
      setFacing(next);
    } catch {
      toast.error("Couldn't switch the camera.");
    }
  }, [facing, attachLocalStream]);

  // ---------- Start a call (initiator) ----------
  const startCall = useCallback(async (roomId: string, peerId: string, peerName: string, type: CallType, peerAvatarUrl?: string | null) => {
    if (!user || callStateRef.current !== "idle") return;
    if (!hasCallPermission(type)) {
      toast.error(callPermissionDenialMessage(type));
      return;
    }

    callRoomIdRef.current = roomId;
    callStateRef.current = "calling";
    callTypeRef.current = type;
    roleRef.current = "caller";
    peerAnsweredRef.current = false;
    initialPeerIdRef.current = peerId;
    setPeer({ id: peerId, name: peerName, avatarUrl: peerAvatarUrl ?? null }); // so the call screen shows who we're calling
    setRingingAck(false);
    setAnswered(false);
    setCallType(type);
    setCallRoomId(roomId);
    setCallState("calling");
    stopRingtone();
    playLoopingAudio("/ringback.mp3", "__callRingback");

    try {
      // Mic/camera prompt and fresh relay credentials in parallel, so the second doesn't add waiting time.
      await Promise.all([ensureLocalStream(type), refreshIceServers()]);
    } catch (err) {
      console.error("startCall media:", err);
      handleMediaError(err, type);
      cleanup();
      return;
    }

    try {
      // The call_logs row's id is the callId used for all signaling — the
      // backend re-checks the callee's rank before this ever reaches them.
      const call = await callsApi.startCall(roomId, peerId, type);
      callIdRef.current = call.id;
      callLogIdRef.current = call.id;

      const entry = createPeer(peerId, peerName, true);
      const offer = await entry.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === "video" });
      await entry.pc.setLocalDescription(offer);

      const callerName = profile?.display_name || profile?.username || "Someone";
      socket?.emit("call:invite", {
        callId: call.id,
        roomId,
        calleeId: peerId,
        callType: type,
        callerName,
        callerAvatarUrl: profile?.avatar_url,
        sdp: offer,
      });

      // The server sends the incoming-call push itself when it receives call:invite.

      // Nobody picked up: stop ringing on this screen. (The server records the call as missed on its own at 45s;
      // this is only the caller's screen catching up, e.g. if the network dropped and the update never arrived.)
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = window.setTimeout(() => {
        if (callStateRef.current === "calling" && !peerAnsweredRef.current && callIdRef.current === call.id) {
          toast.info("No answer");
          finalizeCallLog();
          cleanup();
        }
      }, CALLER_GIVE_UP_MS);
    } catch (err) {
      console.error("startCall:", err);
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      if (status?.status && status.data?.error) toast.error(status.data.error); // e.g. blocked, rank too low
      else handleMediaError(err, type);
      cleanup();
    }
  }, [user, profile, hasCallPermission, stopRingtone, playLoopingAudio, ensureLocalStream, refreshIceServers, createPeer, finalizeCallLog, socket, cleanup]);

  // ---------- Add another participant (mesh, max 4 total) ----------
  const addParticipant = useCallback(async (peerId: string, peerName: string) => {
    if (!user || callStateRef.current === "idle") return;
    if (!hasCallPermission(callTypeRef.current)) {
      toast.error(callPermissionDenialMessage(callTypeRef.current));
      return;
    }
    if (peersRef.current.size >= MAX_PARTICIPANTS) {
      toast.error(`Group call is limited to ${MAX_PARTICIPANTS + 1} people.`);
      return;
    }
    if (peersRef.current.has(peerId) || peerId === user.id) return;
    const roomId = callRoomId;
    if (!roomId) return;

    try {
      const call = await callsApi.startCall(roomId, peerId, callTypeRef.current);
      const stream = await ensureLocalStream(callTypeRef.current);
      const entry = createPeer(peerId, peerName, true);
      stream.getTracks().forEach((t) => {
        if (!entry.pc.getSenders().some((s) => s.track === t)) entry.pc.addTrack(t, stream);
      });
      const offer = await entry.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callTypeRef.current === "video" });
      await entry.pc.setLocalDescription(offer);

      const callerName = profile?.display_name || profile?.username || "Someone";
      // A group-call invite uses its own callId/signaling pair with the new
      // participant, then fans out via "join-mesh" once they answer (see the
      // "answer" branch in the socket listener below) so every existing
      // participant also opens a direct connection to them.
      groupInvitesRef.current.set(call.id, peerId);
      socket?.emit("call:invite", {
        callId: call.id,
        roomId,
        calleeId: peerId,
        callType: callTypeRef.current,
        group: true,
        callerName,
        callerAvatarUrl: profile?.avatar_url,
        sdp: offer,
      });

      // The server sends the incoming-call push itself when it receives call:invite.

      toast.success(`Inviting ${peerName} to call…`);
    } catch (err) {
      console.error("addParticipant:", err);
      toast.error("Couldn't add that person to the call.");
    }
  }, [user, profile, callRoomId, hasCallPermission, ensureLocalStream, createPeer, socket]);

  // ---------- Answer (callee) ----------
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user || !socket) return;
    if (!hasCallPermission(incomingCall.type)) {
      toast.error(callPermissionDenialMessage(incomingCall.type));
      stopRingtone();
      markCallHandled(incomingCall.callId);
      closeCallNotifications(incomingCall.roomId, incomingCall.callId);
      socket.emit("call:signal", { callId: incomingCall.callId, to: incomingCall.from, signal: { type: "reject", reason: "rank_not_permitted" } });
      void callsApi.updateCallStatus(incomingCall.callId, "declined").catch(() => {});
      cleanup();
      return;
    }
    const answeringCall = incomingCall;
    markCallHandled(answeringCall.callId);
    closeCallNotifications(answeringCall.roomId, answeringCall.callId);
    incomingCallRef.current = null;
    callRoomIdRef.current = answeringCall.roomId;
    callStateRef.current = "calling";
    callTypeRef.current = answeringCall.type;
    setIncomingCall(null);
    stopRingtone();
    const type = answeringCall.type;
    setCallType(type);
    setCallRoomId(answeringCall.roomId);
    setCallState("calling");
    callIdRef.current = answeringCall.callId;
    callLogIdRef.current = answeringCall.callId;
    roleRef.current = "callee";
    initialPeerIdRef.current = answeringCall.from;
    setPeer({ id: answeringCall.from, name: answeringCall.name, avatarUrl: answeringCall.avatarUrl ?? null });
    setAnswered(true);
    armConnectTimeout(); // if media never flows, stop with a message instead of hanging on "Connecting…"

    // Record the answer on the server right away (it also stops this call ringing on the user's other devices),
    // instead of waiting for the end of the call, which never came if the app was closed mid-call.
    void callsApi.updateCallStatus(answeringCall.callId, "answered").catch((err) => console.warn("answer report failed", err));

    try {
      if (!answeringCall.sdp) throw new Error("The call is no longer available");
      await ensureLocalStream(type);
      const entry = createPeer(answeringCall.from, answeringCall.name, false);
      if (answeringCall.sdp) {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(answeringCall.sdp));
        entry.hasRemoteDesc = true;
        const drained = entry.pendingCandidates.splice(0);
        for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        socket.emit("call:signal", { callId: answeringCall.callId, to: answeringCall.from, signal: { type: "answer", sdp: answer } });
      }
    } catch (err) {
      console.error("answerCall:", err);
      if ((err as Error)?.message === "The call is no longer available") {
        toast.error("That call is no longer available.");
        finalizeCallLog();
      } else {
        handleMediaError(err, type);
        finalizeCallLog();
      }
      cleanup();
    }
  }, [incomingCall, user, socket, hasCallPermission, finalizeCallLog, markCallHandled, closeCallNotifications, stopRingtone, ensureLocalStream, createPeer, armConnectTimeout, cleanup]);

  const endCall = useCallback(() => {
    peersRef.current.forEach((_entry, peerId) => sendSignal(peerId, { type: "leave" }));

    // The server sends the "call ended" push when the call row's status is updated (finalizeCallLog below).
    // Group invitees who never joined have their own call rows: close those too so their phones stop ringing.
    groupInvitesRef.current.forEach((peerId, callId) => {
      if (!peersRef.current.has(peerId)) void callsApi.updateCallStatus(callId, "cancelled").catch(() => {});
    });
    groupInvitesRef.current.clear();

    finalizeCallLog();
    cleanup();
  }, [sendSignal, user?.id, finalizeCallLog, cleanup]);

  const rejectCall = useCallback(() => {
    stopRingtone();
    if (incomingCall && socket) {
      markCallHandled(incomingCall.callId);
      closeCallNotifications(incomingCall.roomId, incomingCall.callId);
      socket.emit("call:signal", { callId: incomingCall.callId, to: incomingCall.from, signal: { type: "reject", reason: "declined" } });
      void callsApi.updateCallStatus(incomingCall.callId, "declined").catch(() => {});
    }
    cleanup();
  }, [incomingCall, socket, stopRingtone, markCallHandled, closeCallNotifications, cleanup]);

  const toggleMute = useCallback(() => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); broadcastMediaState(); }
  }, [broadcastMediaState]);

  const toggleCamera = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsCameraOff(!t.enabled); broadcastMediaState(); }
  }, [broadcastMediaState]);

  const toggleSpeaker = useCallback(async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    const els = [remoteAudioRef.current, ...Array.from(document.querySelectorAll<HTMLAudioElement>("audio[data-call-remote]"))];
    for (const el of els) {
      if (!el) continue;
      el.volume = next ? 1 : 0.4;
      const any = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (typeof any.setSinkId === "function") {
        try { await any.setSinkId(next ? "default" : ""); } catch { /* ignore */ }
      }
    }
  }, [isSpeakerOn]);

  const toggleScreenShare = useCallback(async () => {
    if (peersRef.current.size === 0) return;
    const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream> };
    if (!md || typeof md.getDisplayMedia !== "function") {
      toast.error("Screen sharing isn't supported on this device/browser. Try desktop Chrome, Edge or Firefox.");
      return;
    }
    if (!window.isSecureContext) {
      toast.error("Screen sharing requires a secure (HTTPS) connection.");
      return;
    }
    if (isScreenSharing) {
      const cam = cameraTrackRef.current;
      peersRef.current.forEach((entry) => {
        const sender = entry.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && cam) void sender.replaceTrack(cam);
      });
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      return;
    }
    try {
      const display = await md.getDisplayMedia!({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      const first = peersRef.current.values().next().value as PeerEntry | undefined;
      const camSender = first?.pc.getSenders().find((s) => s.track?.kind === "video");
      cameraTrackRef.current = camSender?.track ?? null;
      screenStreamRef.current = display;
      peersRef.current.forEach((entry) => {
        const sender = entry.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) void sender.replaceTrack(screenTrack);
      });
      setIsScreenSharing(true);
      screenTrack.onended = () => {
        const cam = cameraTrackRef.current;
        peersRef.current.forEach((entry) => {
          const sender = entry.pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && cam) void sender.replaceTrack(cam);
        });
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      };
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === "NotAllowedError") toast.info("Screen share cancelled.");
      else toast.error(`Screen share failed: ${e?.message || "unknown error"}`);
    }
  }, [isScreenSharing]);

  // ---------- Global socket listener for incoming calls & signaling ----------
  // Unlike the old per-DM-room Supabase channel subscriptions, the backend
  // addresses these directly to this user's personal socket room, so a
  // single always-on listener covers every room without enumerating DMs.
  useEffect(() => {
    if (!socket || !user) return;

    const onInvite = (payload: {
      callId: string;
      roomId: string;
      callerId: string;
      callType: CallType;
      callerName: string;
      callerAvatarUrl?: string | null;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (payload.callerId === user.id) return;
      if (handledCallIdsRef.current.has(payload.callId)) return;
      if (callStateRef.current !== "idle") {
        socket.emit("call:signal", { callId: payload.callId, to: payload.callerId, signal: { type: "reject", reason: "busy" } });
        // On the line already: the call goes into this person's history as a missed call (like WhatsApp).
        markCallHandled(payload.callId);
        void callsApi.updateCallStatus(payload.callId, "missed").catch(() => {});
        return;
      }
      if (incomingCallRef.current?.callId === payload.callId) return;
      if (!hasCallPermission(payload.callType)) {
        // Don't even ring — this rank isn't allowed to receive this call type.
        // The server already checked this too; this is belt-and-braces.
        markCallHandled(payload.callId);
        socket.emit("call:signal", { callId: payload.callId, to: payload.callerId, signal: { type: "reject", reason: "rank_not_permitted" } });
        void callsApi.updateCallStatus(payload.callId, "declined").catch(() => {});
        return;
      }

      callIdRef.current = payload.callId;
      void refreshIceServers();
      setIncomingCall({
        from: payload.callerId,
        name: payload.callerName,
        avatarUrl: payload.callerAvatarUrl ?? null,
        type: payload.callType,
        roomId: payload.roomId,
        callId: payload.callId,
        sdp: payload.sdp,
      });
      setCallType(payload.callType);
      setCallRoomId(payload.roomId);
      setCallState("ringing");
      stopRingtone();
      closeCallNotifications(payload.roomId, payload.callId);
      playLoopingAudio("/ringtone.mp3", "__callRingtone");
      startVibrationLoop();
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = window.setTimeout(() => {
        if (incomingCallRef.current?.callId === payload.callId && callStateRef.current === "ringing") {
          markCallHandled(payload.callId);
          void callsApi.updateCallStatus(payload.callId, "missed").catch(() => {});
          cleanup();
        }
      }, CALLER_GIVE_UP_MS);
    };

    const onSignal = async ({ callId, from, signal }: { callId: string; from: string; signal: any }) => {
      if (callId !== callIdRef.current) return;

      if (signal.type === "reject") {
        markCallHandled(callId);
        if (callStateRef.current === "calling") {
          toast.info(signal.reason === "rank_not_permitted" ? "They're not able to accept this call yet." : signal.reason === "busy" ? "They're on another call." : "Call declined");
          cleanup(); // the callee's side already recorded the outcome on the server
        }
        return;
      }
      if (signal.type === "leave") {
        const entry = peersRef.current.get(from);
        if (entry) { try { entry.pc.close(); } catch { /* ignore */ } peersRef.current.delete(from); }
        refreshParticipantsState();
        if (peersRef.current.size === 0) {
          finalizeCallLog();
          cleanup();
        }
        return;
      }

      let entry = peersRef.current.get(from);
      if (signal.type === "offer") {
        if (!entry) {
          const stream = await ensureLocalStream(callTypeRef.current);
          entry = createPeer(from, signal.callerName || "Participant");
          stream.getTracks().forEach((t) => {
            if (!entry!.pc.getSenders().some((s) => s.track === t)) entry!.pc.addTrack(t, stream);
          });
          await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          entry.hasRemoteDesc = true;
          const drained = entry.pendingCandidates.splice(0);
          for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          sendSignal(from, { type: "answer", sdp: answer });
        } else if (entry.hasRemoteDesc) {
          // The other side is restarting the connection (their network changed): answer so media keeps flowing.
          await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          sendSignal(from, { type: "answer", sdp: answer, restart: true });
        }
      } else if (signal.type === "media-state") {
        setRemoteMedia((prev) => ({ ...prev, [from]: { cameraOff: signal.camera === false, muted: signal.mic === false } }));
      } else if (signal.type === "answer" && entry) {
        if (!peerAnsweredRef.current) {
          // They picked up: the ringback stops and we wait (up to a limit) for the connection.
          peerAnsweredRef.current = true;
          stopRingtone();
          setAnswered(true);
          armConnectTimeout();
        }
        peerAnsweredRef.current = true;
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        entry.hasRemoteDesc = true;
        const drained = entry.pendingCandidates.splice(0);
        for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
        // Mesh fan-out: for group calls, tell every other already-connected
        // peer to open their own direct connection to this new one.
        const joinedName = entry.name;
        if (!signal.restart) {
          peersRef.current.forEach((_other, otherId) => {
            if (otherId !== from) sendSignal(otherId, { type: "join-mesh", peerId: from, peerName: joinedName });
          });
        }
      } else if (signal.type === "join-mesh") {
        if (!peersRef.current.has(signal.peerId)) {
          const stream = await ensureLocalStream(callTypeRef.current);
          const newEntry = createPeer(signal.peerId, signal.peerName || "Participant", true);
          stream.getTracks().forEach((t) => {
            if (!newEntry.pc.getSenders().some((s) => s.track === t)) newEntry.pc.addTrack(t, stream);
          });
          const offer = await newEntry.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callTypeRef.current === "video" });
          await newEntry.pc.setLocalDescription(offer);
          sendSignal(signal.peerId, { type: "offer", sdp: offer });
        }
      } else if (signal.type === "ice") {
        if (!entry) {
          // Still ringing, no connection yet: keep it for when we answer (before, these were dropped, which
          // is a common reason a call connected one way or not at all).
          const list = earlyIceRef.current.get(from) ?? [];
          if (list.length < 200) list.push(signal.candidate);
          earlyIceRef.current.set(from, list);
        } else if (entry.hasRemoteDesc) {
          try { await entry.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch { /* ignore */ }
        } else {
          entry.pendingCandidates.push(signal.candidate);
        }
      }
    };

    // The server tells both people whenever a call changes. This is how the caller's screen stops ringing the
    // moment the other side declines or the call is marked missed, and how a ringing phone stops when the caller
    // hangs up or someone answers on another device.
    const onUpdated = (row: { id: string; status: string; caller_id: string; callee_id: string }) => {
      if (row.id !== callIdRef.current) return;
      // Picked up on another one of my devices: stop ringing here (this device didn't answer, it's still on the ring screen).
      if (row.status === "answered" && row.callee_id === user.id && callStateRef.current === "ringing" && incomingCallRef.current?.callId === row.id) {
        toast.info("Call answered on another device");
        markCallHandled(row.id);
        cleanup();
        return;
      }
      const over = row.status === "declined" || row.status === "missed" || row.status === "cancelled";
      if (!over) return;
      if (callStateRef.current === "calling" && !peerAnsweredRef.current && row.caller_id === user.id) {
        toast.info(row.status === "declined" ? "Call declined" : "No answer");
        markCallHandled(row.id);
        cleanup();
      } else if (callStateRef.current === "ringing" && incomingCallRef.current?.callId === row.id) {
        markCallHandled(row.id);
        cleanup();
      }
    };

    // Ask the server for any call that is ringing for us right now (placed while the app was closed or reconnecting).
    // Done here, after the listeners above exist, so the replayed invite can't arrive before anyone is listening.
    const askForPendingCalls = () => socket.emit("call:pending");
    socket.on("connect", askForPendingCalls);
    if (socket.connected) askForPendingCalls();
    socket.on("call:updated", onUpdated);

    // The server tells the caller whether the other person's app is reachable (-> "Ringing…") or not (-> "Calling…").
    const onRinging = (d: { callId: string; reachable: boolean }) => {
      if (d.callId === callIdRef.current && callStateRef.current === "calling" && !peerAnsweredRef.current) setRingingAck(Boolean(d.reachable));
    };
    socket.on("call:ringing", onRinging);

    socket.on("call:invite", onInvite);
    socket.on("call:signal", onSignal);
    return () => {
      socket.off("call:invite", onInvite);
      socket.off("call:signal", onSignal);
      socket.off("call:updated", onUpdated);
      socket.off("call:ringing", onRinging);
      socket.off("connect", askForPendingCalls);
    };
  }, [socket, user, hasCallPermission, stopRingtone, playLoopingAudio, startVibrationLoop, closeCallNotifications, markCallHandled, ensureLocalStream, refreshIceServers, createPeer, sendSignal, refreshParticipantsState, armConnectTimeout, finalizeCallLog, cleanup]);

  // Keep the screen awake during a video call (a phone left untouched would otherwise lock mid-call).
  useEffect(() => {
    if (callState === "idle" || callType !== "video") return;
    let released = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockHandle> } };
    const acquire = async () => {
      if (released || wakeLockRef.current || !nav.wakeLock) return;
      try {
        const lock = await nav.wakeLock.request("screen");
        if (released) { void lock.release().catch(() => {}); return; }
        wakeLockRef.current = lock;
        lock.addEventListener("release", () => { if (wakeLockRef.current === lock) wakeLockRef.current = null; });
      } catch { /* not allowed (low battery / unsupported): the call still works */ }
    };
    void acquire();
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); }; // the lock is dropped when the tab is hidden
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [callState, callType]);

  const participantsView = useMemo<RemoteParticipant[]>(
    () => participants.map((p) => ({ ...p, ...(remoteMedia[p.peerId] ?? {}) })),
    [participants, remoteMedia]
  );

  const callPhase: CallPhase =
    callState === "idle" ? "idle"
    : callState === "ringing" ? "incoming"
    : callState === "connected" ? (reconnecting ? "reconnecting" : "connected")
    : answered ? "connecting"
    : ringingAck ? "ringing"
    : "calling";

  return (
    <CallContext.Provider value={{
      callState, callType, callRoomId, incomingCall, isMuted, isCameraOff, isScreenSharing, isSpeakerOn,
      peer, callPhase, connectedAt,
      isFrontCamera: facing === "user",
      canSwitchCamera: callType === "video" && hasMultipleCameras && !isScreenSharing,
      switchCamera,
      participants: participantsView,
      localVideoRef, remoteVideoRef, remoteAudioRef,
      startCall, addParticipant, answerCall, endCall, rejectCall,
      toggleMute, toggleCamera, toggleSpeaker, toggleScreenShare,
    }}>
      {children}
    </CallContext.Provider>
  );
}
