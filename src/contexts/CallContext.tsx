import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { canMakeVoiceCall, canMakeVideoCall, callPermissionDenialMessage } from "@/lib/callPermissions";

export type CallType = "voice" | "video";
export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

interface IncomingCall {
  from: string;
  name: string;
  type: CallType;
  roomId: string;
  callId: string;
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

async function waitForChannelJoined(channel: ReturnType<typeof supabase.channel>, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = (channel as unknown as { state?: string }).state;
    if (state === "joined") return true;
    if (state === "closed" || state === "errored") return false;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return false;
}

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

  const callIdRef = useRef<string | null>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dmChannelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const callStateRef = useRef<CallState>("idle");
  const callTypeRef = useRef<CallType>("voice");
  const isInitiatorRef = useRef(false);
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
  // accept a call type the current rank isn't allowed to use.
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
      navigator.vibrate?.([600, 400, 600, 400]);
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

    if (callChannelRef.current) {
      try { supabase.removeChannel(callChannelRef.current); } catch { /* ignore */ }
      callChannelRef.current = null;
    }

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
    isInitiatorRef.current = false;
    callLogIdRef.current = null;
    initialPeerIdRef.current = null;
  }, [stopRingtone, markCallHandled, closeCallNotifications]);

  // ---------- Send via call channel ----------
  const sendSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    const ch = callChannelRef.current;
    if (!ch) return;
    ch.send({ type: "broadcast", event, payload: { ...payload, from: user?.id } });
  }, [user?.id]);

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
      if (e.candidate) {
        sendSignal("ice", { to: peerId, candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      const entry = peersRef.current.get(peerId);
      if (!entry) return;
      const incoming = e.streams[0];
      if (incoming) {
        // Replace the placeholder MediaStream with the actual remote stream
        // so audio/video elements receive a stream that already has tracks.
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
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        stopRingtone();
        if (callStateRef.current !== "connected") setCallState("connected");
      }
    };

    // add local tracks
    const local = localStreamRef.current;
    if (local) {
      local.getTracks().forEach((t) => pc.addTrack(t, local));
    }

    const entry: PeerEntry = { pc, stream, name, pendingCandidates: [], hasRemoteDesc: false };
    peersRef.current.set(peerId, entry);
    return entry;
  }, [sendSignal, refreshParticipantsState, stopRingtone]);

  // ---------- Subscribe to a call channel (initiator OR callee) ----------
  const subscribeCallChannel = useCallback((callId: string) => {
    if (callChannelRef.current) return callChannelRef.current;
    const channel = supabase.channel(`call-${callId}`, { config: { broadcast: { ack: false, self: false } } });

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        const { to, from, name, callType: ct, sdp } = payload as { to: string; from: string; name: string; callType: CallType; sdp: RTCSessionDescriptionInit };
        if (to !== user?.id) return;
        if (callStateRef.current === "idle") return; // shouldn't happen for established channel
        const entry = peersRef.current.get(from) ?? createPeer(from, name || "User");
        try {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          entry.hasRemoteDesc = true;
          const drained = entry.pendingCandidates.splice(0);
          for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          sendSignal("answer", { to: from, sdp: { type: answer.type, sdp: answer.sdp } });
          stopRingtone();
          callStateRef.current = "connected";
          setCallState("connected");
          if (ct) setCallType(ct);
        } catch (err) { console.error("offer handle:", err); }
      })
      .on("broadcast", { event: "ready" }, async ({ payload }) => {
        // Callee has subscribed and is ready to receive the offer.
        const { to, from, name } = payload as { to: string; from: string; name?: string };
        if (to !== user?.id) return;
        try {
          const entry = peersRef.current.get(from) ?? createPeer(from, name || "User");
          const offer = await entry.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callTypeRef.current === "video" });
          await entry.pc.setLocalDescription(offer);
          sendSignal("offer", { to: from, name: (profile as { display_name?: string } | null)?.display_name || "You", callType: callTypeRef.current, sdp: { type: offer.type, sdp: offer.sdp } });
        } catch (err) { console.error("ready handle:", err); }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        const { to, from, sdp } = payload as { to: string; from: string; sdp: RTCSessionDescriptionInit };
        if (to !== user?.id) return;
        const entry = peersRef.current.get(from);
        if (!entry) return;
        try {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          entry.hasRemoteDesc = true;
          const drained = entry.pendingCandidates.splice(0);
          for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
          // Callee picked up — stop ringback. Only mark connected when ICE/media
          // actually connects; otherwise the UI can say connected with no media.
          stopRingtone();
          callStateRef.current = "connected";
          setCallState("connected");
        } catch (err) { console.error("answer handle:", err); }
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        const { to, from, candidate } = payload as { to: string; from: string; candidate: RTCIceCandidateInit };
        if (to !== user?.id) return;
        const entry = peersRef.current.get(from);
        if (!entry) return;
        if (entry.hasRemoteDesc) {
          try { await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
        } else {
          entry.pendingCandidates.push(candidate);
        }
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        const { from } = payload as { from: string };
        const entry = peersRef.current.get(from);
        if (entry) { try { entry.pc.close(); } catch { /* ignore */ } peersRef.current.delete(from); }
        refreshParticipantsState();
        if (peersRef.current.size === 0) cleanup();
      })
      .on("broadcast", { event: "reject" }, ({ payload }) => {
        const { from } = payload as { from: string };
        const entry = peersRef.current.get(from);
        if (entry) { try { entry.pc.close(); } catch { /* ignore */ } peersRef.current.delete(from); }
        refreshParticipantsState();
        if (peersRef.current.size === 0) {
          toast.info("Call declined");
          cleanup();
        }
      })
      .subscribe();

    callChannelRef.current = channel;
    return channel;
  }, [user?.id, profile, createPeer, sendSignal, cleanup, refreshParticipantsState, stopRingtone]);

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

    const callId = `${roomId}-${Date.now()}`;
    callIdRef.current = callId;
    callRoomIdRef.current = roomId;
    callStateRef.current = "calling";
    callTypeRef.current = type;
    isInitiatorRef.current = true;
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

    // Log
    try {
      const { data: row } = await supabase.from("call_logs").insert({
        room_id: roomId,
        caller_id: user.id,
        callee_id: peerId,
        call_type: type,
        status: "cancelled",
        duration_seconds: 0,
      }).select("id").single();
      callLogIdRef.current = row?.id ?? null;
    } catch { /* ignore */ }

    try {
      const callChannel = subscribeCallChannel(callId);
      await waitForChannelJoined(callChannel);
      // Pre-create the peer entry so tracks are bound. Send the offer now and
      // resend on "ready"; this prevents slow/missed ready events from leaving
      // both sides stuck on Calling with no media.
      const entry = createPeer(peerId, peerName);
      const offer = await entry.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === "video" });
      await entry.pc.setLocalDescription(offer);

      const callerName = (profile as { display_name?: string } | null)?.display_name || "Someone";
      const invitePayload = {
        callId,
        from: user.id,
        name: callerName,
        callType: type,
        roomId,
      };

      // Notify peer through the room's DM channel only after caller media and
      // call-channel subscription are ready, so fast answers don't lose signals.
      const dmChannel = dmChannelsRef.current.get(roomId);
      if (dmChannel) {
        await waitForChannelJoined(dmChannel);
        dmChannel.send({
          type: "broadcast",
          event: "call-invite",
          payload: { ...invitePayload, sdp: { type: offer.type, sdp: offer.sdp } },
        });
      }

      // Best-effort push for locked/closed app delivery.
      void supabase.functions.invoke("send-push", {
        body: {
          user_ids: [peerId],
          title: `${callerName} is calling`,
          body: `Incoming ${type} call — tap to answer`,
          data: {
            navigateTo: `/call/${callId}`,
            tag: `call-${callId}`,
            kind: "incoming_call",
            callerName,
            callerId: user.id,
            callType: type,
            roomId,
            callId,
          },
        },
      });
    } catch (err) {
      console.error("startCall:", err);
      handleMediaError(err, type);
      cleanup();
    }
  }, [user, profile, hasCallPermission, stopRingtone, playLoopingAudio, ensureLocalStream, subscribeCallChannel, createPeer, cleanup]);

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
    const callId = callIdRef.current;
    const roomId = callRoomId;
    if (!callId || !roomId) return;

    // Find a DM room between current user and the new peer to send invite via existing DM channel,
    // OR fall back to inviting directly through call-channel "invite" event (peer is listening on user's DMs).
    // For simplicity we send through any DM channel they share; otherwise rely on push.
    const inviteSent = Array.from(dmChannelsRef.current.values()).some((ch) => {
      try {
        ch.send({
          type: "broadcast",
          event: "call-invite",
          payload: {
            callId,
            from: user.id,
            name: (profile as { display_name?: string } | null)?.display_name || "Someone",
            callType: callTypeRef.current,
            roomId,
            targetUserId: peerId,
          },
        });
        return true;
      } catch { return false; }
    });

    try {
      void supabase.functions.invoke("send-push", {
        body: {
          user_ids: [peerId],
          title: `Group ${callTypeRef.current} call`,
          body: `${(profile as { display_name?: string } | null)?.display_name || "Someone"} added you to a call`,
          data: {
            navigateTo: `/call/${callId}`,
            tag: `call-${callId}`,
            kind: "incoming_call",
            callerName: (profile as { display_name?: string } | null)?.display_name || "Someone",
            callerId: user.id,
            callType: callTypeRef.current,
            roomId,
            callId,
          },
        },
      });
    } catch { /* ignore */ }
    if (!inviteSent) toast.info("Invite sent via push notification");

    try {
      createPeer(peerId, peerName);
      toast.success(`Inviting ${peerName} to call…`);
    } catch (err) { console.error("addParticipant:", err); }
  }, [user, profile, callRoomId, hasCallPermission, createPeer]);

  // ---------- Answer (callee) ----------
  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    if (!hasCallPermission(incomingCall.type)) {
      // Rank doesn't permit this call type on the receiving side either —
      // decline automatically rather than letting it connect.
      toast.error(callPermissionDenialMessage(incomingCall.type));
      stopRingtone();
      markCallHandled(incomingCall.callId);
      closeCallNotifications(incomingCall.roomId, incomingCall.callId);
      const dm = dmChannelsRef.current.get(incomingCall.roomId);
      dm?.send({ type: "broadcast", event: "call-reject", payload: { callId: incomingCall.callId, from: user.id } });
      void supabase.from("call_logs").insert({
        room_id: incomingCall.roomId,
        caller_id: incomingCall.from,
        callee_id: user.id,
        call_type: incomingCall.type,
        status: "declined",
        duration_seconds: 0,
      });
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
    const type = incomingCall.type;
    setCallType(type);
    setCallRoomId(incomingCall.roomId);
    setCallState("calling");
    callIdRef.current = incomingCall.callId;
    initialPeerIdRef.current = incomingCall.from;
    isInitiatorRef.current = false;

    try {
      await ensureLocalStream(type);
      // Subscribe to the call channel and only emit "ready" once the
      // realtime channel has actually joined — using a fixed timeout
      // can drop the signal on slow connections, leaving the caller's
      // offer un-sent and no audio/video flowing.
      const ch = subscribeCallChannel(incomingCall.callId);
      const entry = createPeer(incomingCall.from, incomingCall.name);
      await waitForChannelJoined(ch);
      if (entry.hasRemoteDesc) {
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        sendSignal("answer", { to: incomingCall.from, sdp: { type: answer.type, sdp: answer.sdp } });
        callStateRef.current = "connected";
        setCallState("connected");
      }
      sendSignal("ready", {
        to: incomingCall.from,
        name: (profile as { display_name?: string } | null)?.display_name || "User",
      });
      // Move to "calling" until ICE actually connects; the connectionstate /
      // iceconnectionstate handler will flip us to "connected" when media flows.
      if (!entry.hasRemoteDesc) setCallState("calling");
    } catch (err) {
      console.error("answerCall:", err);
      handleMediaError(err, type);
      cleanup();
    }
  }, [incomingCall, user, profile, hasCallPermission, markCallHandled, closeCallNotifications, stopRingtone, ensureLocalStream, subscribeCallChannel, createPeer, sendSignal, cleanup]);

  const endCall = useCallback(() => {
    const activeRoomId = callRoomIdRef.current;
    const activeCallId = callIdRef.current;
    const notifyUserIds = Array.from(new Set([
      initialPeerIdRef.current,
      ...Array.from(peersRef.current.keys()),
    ].filter((id): id is string => Boolean(id && id !== user?.id))));
    sendSignal("leave", {});
    if (activeRoomId && activeCallId) {
      dmChannelsRef.current.get(activeRoomId)?.send({
        type: "broadcast",
        event: "call-end",
        payload: { callId: activeCallId, from: user?.id },
      });
      if (notifyUserIds.length > 0) {
        void supabase.functions.invoke("send-push", {
          body: {
            user_ids: notifyUserIds,
            title: "Call ended",
            body: "The call has ended",
            data: { kind: "call_cancelled", tag: `call-${activeCallId}`, callId: activeCallId, roomId: activeRoomId },
          },
        });
      }
    }
    // Update log
    if (callLogIdRef.current) {
      const status = callStateRef.current === "connected" ? "answered" : "cancelled";
      void supabase.from("call_logs").update({ status }).eq("id", callLogIdRef.current);
    }
    cleanup();
  }, [sendSignal, user?.id, cleanup]);

  const rejectCall = useCallback(() => {
    stopRingtone();
    if (incomingCall) {
      markCallHandled(incomingCall.callId);
      closeCallNotifications(incomingCall.roomId, incomingCall.callId);
      // Send reject via the call channel after subscribing briefly, OR via DM channel.
      const dm = dmChannelsRef.current.get(incomingCall.roomId);
      dm?.send({ type: "broadcast", event: "call-reject", payload: { callId: incomingCall.callId, from: user?.id } });
      // Log declined for callee
      void supabase.from("call_logs").insert({
        room_id: incomingCall.roomId,
        caller_id: incomingCall.from,
        callee_id: user?.id,
        call_type: incomingCall.type,
        status: "declined",
        duration_seconds: 0,
      });
    }
    cleanup();
  }, [incomingCall, user?.id, stopRingtone, markCallHandled, closeCallNotifications, cleanup]);

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
      // remember camera track from first peer
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

  // ---------- Subscribe to DM channels for incoming call invites ----------
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const setup = async () => {
      const { data: memberships } = await supabase.from("room_members").select("room_id").eq("user_id", user.id);
      if (!memberships || !mounted) return;
      const roomIds = memberships.map((m) => m.room_id);
      if (roomIds.length === 0) return;
      const { data: rooms } = await supabase.from("rooms").select("id").in("id", roomIds).eq("type", "dm");
      if (!rooms || !mounted) return;

      for (const room of rooms) {
        if (dmChannelsRef.current.has(room.id)) continue;
        const ch = supabase.channel(`call-room-${room.id}`);
        ch.on("broadcast", { event: "call-invite" }, ({ payload }) => {
          const p = payload as { callId: string; from: string; name: string; callType: CallType; roomId: string; targetUserId?: string; sdp?: RTCSessionDescriptionInit };
          if (p.from === user.id) return;
          if (p.targetUserId && p.targetUserId !== user.id) return;
          if (handledCallIdsRef.current.has(p.callId)) return;
          if (callStateRef.current !== "idle") return;
          if (incomingCallRef.current?.callId === p.callId) return;
          if (!hasCallPermission(p.callType)) {
            // Don't even ring — this rank isn't allowed to receive this call type.
            // Decline immediately so the caller isn't left hanging.
            markCallHandled(p.callId);
            void supabase.from("call_logs").insert({
              room_id: p.roomId,
              caller_id: p.from,
              callee_id: user.id,
              call_type: p.callType,
              status: "declined",
              duration_seconds: 0,
            });
            const dm = dmChannelsRef.current.get(p.roomId);
            dm?.send({ type: "broadcast", event: "call-reject", payload: { callId: p.callId, from: user.id } });
            return;
          }
          callIdRef.current = p.callId;
          if (p.sdp) {
            const entry = createPeer(p.from, p.name || "User");
            void entry.pc.setRemoteDescription(new RTCSessionDescription(p.sdp)).then(async () => {
              entry.hasRemoteDesc = true;
              const drained = entry.pendingCandidates.splice(0);
              for (const c of drained) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
            }).catch((err) => console.error("incoming invite offer:", err));
          }
          setIncomingCall({ from: p.from, name: p.name, type: p.callType, roomId: p.roomId, callId: p.callId });
          setCallType(p.callType);
          setCallRoomId(p.roomId);
          setCallState("ringing");
          stopRingtone();
          closeCallNotifications(p.roomId, p.callId);
          playLoopingAudio("/ringtone.mp3", "__callRingtone");
          startVibrationLoop();
          if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = window.setTimeout(() => {
            if (incomingCallRef.current?.callId === p.callId && callStateRef.current === "ringing") {
              markCallHandled(p.callId);
              cleanup();
            }
          }, 60_000);
        }).on("broadcast", { event: "call-reject" }, ({ payload }) => {
          const p = payload as { from: string; callId?: string };
          if (p.from === user.id) return;
          if (p.callId) markCallHandled(p.callId);
          if (callStateRef.current === "calling") {
            toast.info("Call declined");
            cleanup();
          }
        }).on("broadcast", { event: "call-end" }, ({ payload }) => {
          const p = payload as { from: string; callId?: string };
          if (p.from === user.id) return;
          if (p.callId) markCallHandled(p.callId);
          if (!p.callId || incomingCallRef.current?.callId === p.callId || callIdRef.current === p.callId) {
            cleanup();
          }
        }).subscribe();
        dmChannelsRef.current.set(room.id, ch);
      }
    };

    const channels = dmChannelsRef.current;
    setup();
    return () => {
      mounted = false;
      channels.forEach((ch) => { try { supabase.removeChannel(ch); } catch { /* ignore */ } });
      channels.clear();
      stopRingtone();
    };
  }, [user, hasCallPermission, stopRingtone, playLoopingAudio, startVibrationLoop, closeCallNotifications, markCallHandled, createPeer, cleanup]);

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
