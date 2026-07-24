import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X, Volume2, VolumeX, MonitorUp, MonitorOff, UserPlus } from "lucide-react";
import type { CallState, CallType, RemoteParticipant } from "@/contexts/CallContext";
import { RefObject, useEffect, useRef } from "react";

interface CallOverlayProps {
  callState: CallState;
  callType: CallType;
  peerName: string;
  participants: RemoteParticipant[];
  incomingCall: { from: string; name: string; type: CallType; roomId: string } | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  remoteAudioRef: RefObject<HTMLAudioElement>;
  onAnswer: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onToggleScreenShare: () => void;
  onAddParticipant?: () => void;
  canAddParticipant?: boolean;
}

function ParticipantTile({ p, isVideo }: { p: RemoteParticipant; isVideo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = p.stream;
      videoRef.current.muted = true; // audio routed via audio el
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current) {
      audioRef.current.srcObject = p.stream;
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
      audioRef.current.play().catch(() => {});
    }
  }, [p.stream]);

  const hasVideo = !!p.stream && p.stream.getVideoTracks().length > 0;

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden">
      {isVideo && hasVideo ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
          <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-lg font-bold">
            {p.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay playsInline data-call-remote className="hidden" />
      <div className="absolute bottom-1 left-1 right-1 bg-background/60 backdrop-blur px-2 py-0.5 rounded text-[11px] text-foreground truncate">
        {p.name}
      </div>
    </div>
  );
}

export default function CallOverlay({
  callState,
  callType,
  peerName,
  participants,
  incomingCall,
  isMuted,
  isCameraOff,
  isSpeakerOn,
  isScreenSharing,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  onAnswer,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onToggleScreenShare,
  onAddParticipant,
  canAddParticipant,
}: CallOverlayProps) {
  if (callState === "idle") return null;

  if (callState === "ringing" && incomingCall) {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 flex flex-col items-center justify-center gap-6">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold animate-pulse">
          {incomingCall.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-display font-bold text-foreground">{incomingCall.name}</h2>
        <p className="text-muted-foreground text-sm">Incoming {incomingCall.type} call...</p>
        <div className="flex gap-8 mt-4">
          <button onClick={onReject} className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground"><X className="w-7 h-7" /></button>
          <button onClick={onAnswer} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground animate-pulse"><Phone className="w-7 h-7" /></button>
        </div>
      </div>
    );
  }

  const isGroup = participants.length > 1;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {callType === "video" ? (
        <div className="flex-1 relative bg-muted">
          {isGroup ? (
            <div className="grid grid-cols-2 gap-1 p-1 w-full h-full">
              {participants.map((p) => (
                <ParticipantTile key={p.peerId} p={p} isVideo />
              ))}
            </div>
          ) : (
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          )}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-4 right-4 w-24 h-32 rounded-xl object-cover border-2 border-card shadow-elevated"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          {isGroup ? (
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {participants.map((p) => (
                <div key={p.peerId} className="aspect-square">
                  <ParticipantTile p={p} isVideo={false} />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-3xl font-bold">
                {peerName.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-display font-bold text-foreground">{peerName}</h2>
              <p className="text-muted-foreground text-sm">{callState === "calling" ? "Calling..." : "Connected"}</p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 py-6 px-3 bg-card border-t border-border flex-wrap">
        <button onClick={onToggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center ${isMuted ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}>
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {callType === "video" && (
          <button onClick={onToggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center ${isCameraOff ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}>
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        <button onClick={onToggleSpeaker} aria-label="Toggle speaker" className={`w-12 h-12 rounded-full flex items-center justify-center ${isSpeakerOn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        {callType === "video" && (
          <button onClick={onToggleScreenShare} aria-label="Share screen" className={`w-12 h-12 rounded-full flex items-center justify-center ${isScreenSharing ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
          </button>
        )}

        {canAddParticipant && onAddParticipant && (
          <button onClick={onAddParticipant} aria-label="Add participant" className="w-12 h-12 rounded-full bg-muted text-foreground flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </button>
        )}

        <button onClick={onEnd} className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
