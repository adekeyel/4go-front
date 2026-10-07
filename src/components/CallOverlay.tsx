import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, MonitorUp, MonitorOff, UserPlus, SwitchCamera } from "lucide-react";
import type { CallPeer, CallPhase, CallState, CallType, RemoteParticipant } from "@/contexts/CallContext";
import { RefObject, useEffect, useRef, useState } from "react";

interface CallOverlayProps {
  callState: CallState;
  callType: CallType;
  phase: CallPhase;
  /** When media started flowing (ms since epoch); drives the timer. */
  connectedAt: number | null;
  /** The other person on a 1:1 call. */
  peer: CallPeer | null;
  participants: RemoteParticipant[];
  incomingCall: { from: string; name: string; avatarUrl?: string | null; type: CallType; roomId: string } | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
  isFrontCamera: boolean;
  canSwitchCamera: boolean;
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
  onSwitchCamera: () => void;
  onAddParticipant?: () => void;
  canAddParticipant?: boolean;
}

/** 0:07 / 12:34 / 1:02:03, ticking every second once the call is connected. */
function useCallTimer(startedAt: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
}

function statusLabel(phase: CallPhase, timer: string | null): string {
  switch (phase) {
    case "connected": return timer ?? "Connected";
    case "reconnecting": return "Reconnecting…";
    case "connecting": return "Connecting…";
    case "ringing": return "Ringing…";
    case "incoming": return "Incoming call";
    default: return "Calling…";
  }
}

function CallAvatar({ name, url, size, pulse }: { name: string; url?: string | null; size: number; pulse?: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {pulse && <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "2s" }} />}
      {url ? (
        <img src={url} alt={name} className="relative w-full h-full rounded-full object-cover border-2 border-white/20" />
      ) : (
        <div className="relative w-full h-full rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold" style={{ fontSize: size * 0.4 }}>
          {name.charAt(0).toUpperCase() || "?"}
        </div>
      )}
    </div>
  );
}

function RoundButton({ onClick, label, active, danger, children, big }: { onClick: () => void; label: string; active?: boolean; danger?: boolean; children: React.ReactNode; big?: boolean }) {
  const size = big ? "w-16 h-16" : "w-12 h-12";
  const tone = danger ? "bg-red-500 text-white" : active ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25";
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`${size} shrink-0 rounded-full flex items-center justify-center transition-colors active:scale-95 ${tone}`}>
      {children}
    </button>
  );
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

  const hasVideo = !!p.stream && p.stream.getVideoTracks().length > 0 && !p.cameraOff;

  return (
    <div className="relative bg-white/10 rounded-xl overflow-hidden min-h-[8rem]">
      {isVideo && hasVideo ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
          <CallAvatar name={p.name} size={56} />
          {isVideo && p.cameraOff && <span className="text-[11px] text-white/70">Camera off</span>}
        </div>
      )}
      <audio ref={audioRef} autoPlay playsInline data-call-remote className="hidden" />
      <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[11px] text-white">
        {p.muted && <MicOff className="w-3 h-3 shrink-0 text-red-400" />}
        <span className="truncate">{p.name}</span>
      </div>
    </div>
  );
}

export default function CallOverlay({
  callState, callType, phase, connectedAt, peer, participants, incomingCall,
  isMuted, isCameraOff, isSpeakerOn, isScreenSharing, isFrontCamera, canSwitchCamera,
  localVideoRef, remoteVideoRef, remoteAudioRef,
  onAnswer, onReject, onEnd, onToggleMute, onToggleCamera, onToggleSpeaker, onToggleScreenShare, onSwitchCamera,
  onAddParticipant, canAddParticipant,
}: CallOverlayProps) {
  const timer = useCallTimer(phase === "connected" || phase === "reconnecting" ? connectedAt : null);
  if (callState === "idle") return null;

  const darkBg = "bg-gradient-to-b from-[#0f5c54] via-[#0b2b2a] to-[#0b141a]";

  // ----- Incoming call (ringing) -----
  if (callState === "ringing" && incomingCall) {
    const isVideo = incomingCall.type === "video";
    return (
      <div className={`fixed inset-0 z-[200] ${darkBg} text-white flex flex-col items-center px-6 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]`}>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <p className="text-sm text-white/70 flex items-center gap-1.5">{isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}Incoming {isVideo ? "video" : "voice"} call</p>
        <h2 className="mt-2 text-3xl font-semibold text-center break-words max-w-full">{incomingCall.name}</h2>
        <div className="flex-1 flex items-center justify-center">
          <CallAvatar name={incomingCall.name} url={incomingCall.avatarUrl} size={168} pulse />
        </div>
        <div className="flex items-center justify-center gap-16">
          <div className="flex flex-col items-center gap-2">
            <RoundButton onClick={onReject} label="Decline" danger big><PhoneOff className="w-7 h-7" /></RoundButton>
            <span className="text-xs text-white/80">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onAnswer} aria-label="Accept" title="Accept" className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center animate-pulse active:scale-95">
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
            <span className="text-xs text-white/80">Accept</span>
          </div>
        </div>
      </div>
    );
  }

  // ----- In a call (calling / ringing / connecting / connected) -----
  const isGroup = participants.length > 1;
  const name = peer?.name ?? participants[0]?.name ?? "Call";
  const first = participants[0];
  const waiting = phase === "calling" || phase === "ringing" || phase === "connecting";
  const remoteHasVideo = !!first?.stream && first.stream.getVideoTracks().length > 0 && !first.cameraOff && !waiting;
  // While waiting for the other person, show MY camera full-screen (like WhatsApp); once connected it shrinks to a corner.
  const selfFull = callType === "video" && !isGroup && waiting && !isCameraOff;
  const mirror = isFrontCamera && !isScreenSharing;

  const controls = (
    <div className="flex items-center justify-center gap-3 flex-wrap rounded-3xl bg-black/40 backdrop-blur px-4 py-3 mx-3 mb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <RoundButton onClick={onToggleSpeaker} label="Speaker" active={isSpeakerOn}>{isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</RoundButton>
      {callType === "video" && (
        <RoundButton onClick={onToggleCamera} label={isCameraOff ? "Turn camera on" : "Turn camera off"} active={isCameraOff}>{isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}</RoundButton>
      )}
      {callType === "video" && canSwitchCamera && (
        <RoundButton onClick={onSwitchCamera} label="Switch camera"><SwitchCamera className="w-5 h-5" /></RoundButton>
      )}
      <RoundButton onClick={onToggleMute} label={isMuted ? "Unmute" : "Mute"} active={isMuted}>{isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</RoundButton>
      {callType === "video" && (
        <RoundButton onClick={onToggleScreenShare} label={isScreenSharing ? "Stop sharing" : "Share screen"} active={isScreenSharing}>{isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}</RoundButton>
      )}
      {canAddParticipant && onAddParticipant && (
        <RoundButton onClick={onAddParticipant} label="Add participant"><UserPlus className="w-5 h-5" /></RoundButton>
      )}
      <RoundButton onClick={onEnd} label="End call" danger big><PhoneOff className="w-6 h-6" /></RoundButton>
    </div>
  );

  const header = (
    <div className={`absolute inset-x-0 top-0 z-20 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-8 text-center text-white ${callType === "video" ? "bg-gradient-to-b from-black/60 to-transparent" : ""}`}>
      <h2 className="text-xl font-semibold truncate">{isGroup ? `${participants.length + 1} people` : name}</h2>
      <p className={`text-sm tabular-nums ${phase === "reconnecting" ? "text-yellow-300" : "text-white/75"}`}>{statusLabel(phase, timer)}</p>
    </div>
  );

  if (callType === "video") {
    return (
      <div className="fixed inset-0 z-[200] bg-black text-white overflow-hidden flex flex-col">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <div className="relative flex-1 min-h-0">
          {isGroup ? (
            <div className="grid grid-cols-2 gap-1 p-1 pt-24 w-full h-full">
              {participants.map((p) => <ParticipantTile key={p.peerId} p={p} isVideo />)}
            </div>
          ) : (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity ${remoteHasVideo ? "opacity-100" : "opacity-0"}`} />
              {!remoteHasVideo && !selfFull && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${darkBg}`}>
                  <CallAvatar name={name} url={peer?.avatarUrl} size={144} pulse={waiting} />
                  {first?.cameraOff && !waiting && <span className="text-sm text-white/70">{name} turned off their camera</span>}
                </div>
              )}
            </>
          )}

          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: mirror ? "scaleX(-1)" : undefined }}
            className={
              selfFull
                ? "absolute inset-0 w-full h-full object-cover"
                : "absolute right-3 top-24 z-10 w-28 h-40 rounded-2xl object-cover border border-white/30 shadow-lg bg-black"
            }
          />
          {isCameraOff && !selfFull && !isGroup && (
            <div className="absolute right-3 top-24 z-10 w-28 h-40 rounded-2xl bg-black/70 flex items-center justify-center pointer-events-none"><VideoOff className="w-6 h-6 text-white/80" /></div>
          )}
          {header}
        </div>
        {controls}
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[200] ${darkBg} text-white flex flex-col`}>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="relative flex-1 flex items-center justify-center p-4">
        {header}
        {isGroup ? (
          <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-16">
            {participants.map((p) => <div key={p.peerId} className="aspect-square"><ParticipantTile p={p} isVideo={false} /></div>)}
          </div>
        ) : (
          <CallAvatar name={name} url={peer?.avatarUrl} size={168} pulse={waiting} />
        )}
      </div>
      {controls}
    </div>
  );
}
