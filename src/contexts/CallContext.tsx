import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import { toast } from "sonner";
import { canMakeVoiceCall, canMakeVideoCall, callPermissionDenialMessage } from "@/lib/callPermissions";
import * as callsApi from "@/api/calls";

export type CallType = "voice" | "video";
export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

interface IncomingCall {
  from: string;
  name: string;
  type: CallType;
  roomId: string;
  callId: string;
  sdp?: RTCSessionDescriptionInit;
}

export interface RemoteParticipant {
  peerId: string;
  name: string;
  stream: MediaStream | null;
}

interface CallContextValue {
  callState: CallState;
  callType: CallType;
  callRoomId: string | null;
  incomingCall: IncomingCall | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isSpeakerOn: boolean;
  participants: RemoteParticipant[];
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>; // legacy single-peer (1st participant)
  remoteAudioRef: React.RefObject<HTMLAudioElement>; // legacy single-peer
  startCall: (roomId: string, peerId: string, peerName: string, type: CallType) => Promise<void>;
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

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const MAX_PARTICIPANTS = 3; // max 4-way (self + 3 others)

interface PeerEntry {
  pc: RTCPeerConnection;
  stream: MediaStream;
  name: string;
  pendingCandidates: RTCIceCandidateInit[];
  hasRemoteDesc: boolean;
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

  const finalizeCallLog = useCallback((status: "answered" | "declined" | "cancelled" | "missed") => {
    if (!callLogIdRef.current) return;
    void callsApi.updateCallStatus(callLogIdRef.current, status).catch((err) => console.warn("call log update failed", err));
  }, []);

  // ---------- Cleanup ----------
  const cleanup = useCallback(() => {
    stopRingtone();
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    const activeCallId = callIdRef.current ?? incomingCallRef.current?.callId;
    const activeRoomId = callRoomIdRef.current ?? incomingCallRef.current?.roomId;
    markCallHandled(activeCallId);
    closeCallNotifications(activeRoomId, activeCallId);
    peersRef.current.forEach((entry) => { try { entry.pc.close(); } catch { /* ignore */ } });
    peersRef.current.clear();
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

  // ---------- Create a peer entry ----------
  const createPeer = useCallback((peerId: string, name: string): PeerEntry => {
    const existing = peersRef.current.get(peerId);
    if (existing) {
      const local = localStreamRef.current;
      if (local && existing.pc.getSenders().length === 0) {
        local.getTracks().forEach((t) => existing.pc.addTrack(t, local));
      }
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
      stopRingtone();
      if (callStateRef.current !== "connected") {
        callStateRef.current = "connected";
        setCallState("connected");
      }
      refreshParticipantsState();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        stopRingtone();
        if (callStateRef.current !== "connected") setCallState("connected");
      }
      if (pc.connectionState === "failed") {
        try { pc.restartIce(); } catch { /* ignore */ }
      }
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        const entry = peersRef.current.get(peerId);
        if (entry) {
          peersRef.current.delete(peerId);
          refreshParticipantsState();
          if (peersRef.current.size === 0 && callStateRef.current !== "idle") {
            finalizeCallLog(callStateRef.current === "connected" ? "answered" : "cancelled");
            cleanup();
          }
        }
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        stopRingtone();
        if (callStateRef.current !== "connected") setCallState("connected");
      }
    };

    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

    const entry: PeerEntry = { pc, stream, name, pendingCandidates: [], hasRemoteDesc: false };
    peersRef.current.set(peerId, entry);
    return entry;
  }, [sendSignal, refreshParticipantsState, stopRingtone, finalizeCallLog, cleanup]);

  // ---------- Get local media (idempotent) ----------
  const ensureLocalStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current;
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    attachLocalStream(stream);
    return stream;
  }, [attachLocalStream]);

  // ---------- Start a call (initiator) ----------
  const startCall = useCallback(async (roomId: string, peerId: string, peerName: string, type: CallType) => {
    if (!user || callStateRef.current !== "idle") return;
    if (!hasCallPermission(type)) {
      toast.error(callPermissionDenialMessage(type));
      return;
    }

    callRoomIdRef.current = roomId;
    callStateRef.current = "calling";
    callTypeRef.current = type;
    initialPeerIdRef.current = peerId;
    setCallType(type);
    setCallRoomId(roomId);
    setCallState("calling");
    stopRingtone();
    playLoopingAudio("/ringback.mp3", "__callRingback");

    try {
      await ensureLocalStream(type);
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

      const entry = createPeer(peerId, peerName);
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
    } catch (err) {
      console.error("startCall:", err);
      handleMediaError(err, type);
      cleanup();
    }
  }, [user, profile, hasCallPermission, stopRingtone, playLoopingAudio, ensureLocalStream, createPeer, socket, cleanup]);

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
      const entry = createPeer(peerId, peerName);
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
    initialPeerIdRef.current = answeringCall.from;

    try {
      await ensureLocalStream(type);
      const entry = createPeer(answeringCall.from, answeringCall.name);
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
      handleMediaError(err, type);
      cleanup();
    }
  }, [incomingCall, user, socket, hasCallPermission, markCallHandled, closeCallNotifications, stopRingtone, ensureLocalStream, createPeer, cleanup]);

  const endCall = useCallback(() => {
    peersRef.current.forEach((_entry, peerId) => sendSignal(peerId, { type: "leave" }));

    // The server sends the "call ended" push when the call row's status is updated (finalizeCallLog below).
    // Group invitees who never joined have their own call rows: close those too so their phones stop ringing.
    groupInvitesRef.current.forEach((peerId, callId) => {
      if (!peersRef.current.has(peerId)) void callsApi.updateCallStatus(callId, "cancelled").catch(() => {});
    });
    groupInvitesRef.current.clear();

    finalizeCallLog(callStateRef.current === "connected" ? "answered" : "cancelled");
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
    if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
  }, []);

  const toggleCamera = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsCameraOff(!t.enabled); }
  }, []);

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
      setIncomingCall({
        from: payload.callerId,
        name: payload.callerName,
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
      }, 60_000);
    };

    const onSignal = async ({ callId, from, signal }: { callId: string; from: string; signal: any }) => {
      if (callId !== callIdRef.current) return;

      if (signal.type === "reject") {
        markCallHandled(callId);
        if (callStateRef.current === "calling") {
          toast.info(signal.reason === "rank_not_permitted" ? "They're not able to accept this call yet." : signal.reason === "busy" ? "They're on another call." : "Call declined");
          finalizeCallLog("declined");
          cleanup();
        }
        return;
      }
      if (signal.type === "leave") {
        const entry = peersRef.current.get(from);
        if (entry) { try { entry.pc.close(); } catch { /* ignore */ } peersRef.current.delete(from); }
        refreshParticipantsState();
        if (peersRef.current.size === 0) {
          finalizeCallLog(callStateRef.current === "connected" ? "answered" : "cancelled");
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
        }
      } else if (signal.type === "answer" && entry) {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        entry.hasRemoteDesc = true;
        const drained = entry.pendingCandidates.splice(0);
        for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
        // Mesh fan-out: for group calls, tell every other already-connected
        // peer to open their own direct connection to this new one.
        const joinedName = entry.name;
        peersRef.current.forEach((_other, otherId) => {
          if (otherId !== from) sendSignal(otherId, { type: "join-mesh", peerId: from, peerName: joinedName });
        });
      } else if (signal.type === "join-mesh") {
        if (!peersRef.current.has(signal.peerId)) {
          const stream = await ensureLocalStream(callTypeRef.current);
          const newEntry = createPeer(signal.peerId, signal.peerName || "Participant");
          stream.getTracks().forEach((t) => {
            if (!newEntry.pc.getSenders().some((s) => s.track === t)) newEntry.pc.addTrack(t, stream);
          });
          const offer = await newEntry.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callTypeRef.current === "video" });
          await newEntry.pc.setLocalDescription(offer);
          sendSignal(signal.peerId, { type: "offer", sdp: offer });
        }
      } else if (signal.type === "ice" && entry) {
        if (entry.hasRemoteDesc) {
          try { await entry.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch { /* ignore */ }
        } else {
          entry.pendingCandidates.push(signal.candidate);
        }
      }
    };

    socket.on("call:invite", onInvite);
    socket.on("call:signal", onSignal);
    return () => {
      socket.off("call:invite", onInvite);
      socket.off("call:signal", onSignal);
    };
  }, [socket, user, hasCallPermission, stopRingtone, playLoopingAudio, startVibrationLoop, closeCallNotifications, markCallHandled, ensureLocalStream, createPeer, sendSignal, refreshParticipantsState, finalizeCallLog, cleanup]);

  return (
    <CallContext.Provider value={{
      callState, callType, callRoomId, incomingCall, isMuted, isCameraOff, isScreenSharing, isSpeakerOn,
      participants,
      localVideoRef, remoteVideoRef, remoteAudioRef,
      startCall, addParticipant, answerCall, endCall, rejectCall,
      toggleMute, toggleCamera, toggleSpeaker, toggleScreenShare,
    }}>
      {children}
    </CallContext.Provider>
  );
}
