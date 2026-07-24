import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CallType = "voice" | "video";
export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

interface UseCallOptions {
  roomId: string;
  peerId: string;
  peerName: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

export function useCall({ roomId, peerId, peerName }: UseCallOptions) {
  const { user, profile } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("voice");
  const [incomingCall, setIncomingCall] = useState<{ from: string; name: string; type: CallType } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    setCallState("idle");
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate.toJSON(), from: user?.id },
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        remoteStreamRef.current = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        cleanup();
      }
    };

    // Also handle ICE connection state for more reliable detection
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        // Try ICE restart
        pc.restartIce();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [user, cleanup]);

  const addPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    }
  }, []);

  const startCall = useCallback(async (type: CallType) => {
    if (!user || callState !== "idle") return;

    setCallType(type);
    setCallState("calling");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === "video",
      });
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: "broadcast",
        event: "call-offer",
        payload: {
          offer: { type: offer.type, sdp: offer.sdp },
          from: user.id,
          name: profile?.display_name || "Someone",
          callType: type,
        },
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      cleanup();
    }
  }, [user, profile, callState, createPeerConnection, cleanup]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    setCallType(incomingCall.type);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: incomingCall.type === "video",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        console.error("No peer connection or remote description when answering");
        cleanup();
        return;
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Flush any pending ICE candidates now that local description is set
      await addPendingCandidates();

      channelRef.current?.send({
        type: "broadcast",
        event: "call-answer",
        payload: { answer: { type: answer.type, sdp: answer.sdp }, from: user.id },
      });

      setCallState("connected");
      setIncomingCall(null);
    } catch (err) {
      console.error("Failed to answer call:", err);
      cleanup();
    }
  }, [incomingCall, user, cleanup, addPendingCandidates]);

  const endCall = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: user?.id },
    });
    cleanup();
  }, [user, cleanup]);

  const rejectCall = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-reject",
      payload: { from: user?.id },
    });
    setIncomingCall(null);
    setCallState("idle");
  }, [user]);

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, []);

  // Set up signaling channel
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`call-${roomId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "call-offer" }, async ({ payload }) => {
        if (payload.from === user.id) return;
        
        // Create peer connection and set remote offer
        const pc = createPeerConnection();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          // Flush any candidates that arrived before the offer
          await addPendingCandidates();
        } catch (err) {
          console.error("Error setting remote offer:", err);
          return;
        }

        setIncomingCall({ from: payload.from, name: payload.name, type: payload.callType });
        setCallState("ringing");
      })
      .on("broadcast", { event: "call-answer" }, async ({ payload }) => {
        if (payload.from === user.id) return;
        if (pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            // Flush any candidates that arrived before the answer
            await addPendingCandidates();
            setCallState("connected");
          } catch (err) {
            console.error("Error setting remote answer:", err);
          }
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === user.id) return;
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {
            // Ignore candidate errors
          }
        } else {
          // Queue candidates that arrive before remote description
          pendingCandidatesRef.current.push(payload.candidate);
        }
      })
      .on("broadcast", { event: "call-end" }, ({ payload }) => {
        if (payload.from === user.id) return;
        cleanup();
      })
      .on("broadcast", { event: "call-reject" }, ({ payload }) => {
        if (payload.from === user.id) return;
        cleanup();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      cleanup();
    };
  }, [roomId, user]);

  return {
    callState,
    callType,
    incomingCall,
    isMuted,
    isCameraOff,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    rejectCall,
    toggleMute,
    toggleCamera,
  };
}
