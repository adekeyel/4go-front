import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallContext } from "@/contexts/CallContext";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, PhoneOff, Video } from "lucide-react";

/**
 * Dedicated in-app ringing screen opened by a notification tap.
 * Route: /call/:callId
 * Query params:
 *   - accept_call=1  → auto-answer once the invite arrives
 *   - decline_call=1 → auto-decline
 */
export default function IncomingCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const call = useCallContext();
  const handledRef = useRef(false);

  const wantAccept = params.get("accept_call") === "1";
  const wantDecline = params.get("decline_call") === "1";

  // If unauthenticated, send to login then bring user back here
  useEffect(() => {
    if (!loading && !user) {
      navigate(`/login?redirect=/call/${callId || ""}`, { replace: true });
    }
  }, [loading, user, navigate, callId]);

  // Auto handle once an incoming call matching the URL appears
  useEffect(() => {
    if (handledRef.current) return;
    if (!call.incomingCall) return;
    if (callId && call.incomingCall.callId !== callId) return;

    if (wantDecline) {
      handledRef.current = true;
      call.rejectCall();
      navigate("/", { replace: true });
    } else if (wantAccept) {
      handledRef.current = true;
      void call.answerCall();
      // GlobalCallOverlay takes over; leave the page so back nav works
      navigate("/", { replace: true });
    }
  }, [call, callId, wantAccept, wantDecline, navigate]);

  // Once user is in a call, hop home so the global overlay covers the screen
  useEffect(() => {
    if (call.callState === "connected") {
      navigate("/", { replace: true });
    }
  }, [call.callState, navigate]);

  const incoming = call.incomingCall;
  const matches = !callId || !incoming || incoming.callId === callId;

  return (
    <div className="fixed inset-0 z-[150] bg-gradient-to-b from-[#0f5c54] via-[#0b2b2a] to-[#0b141a] text-white flex flex-col items-center justify-center px-6 text-center gap-6">
      {incoming?.avatarUrl ? (
        <img src={incoming.avatarUrl} alt={incoming.name} className="w-32 h-32 rounded-full object-cover border-2 border-white/20 animate-pulse" />
      ) : (
        <div className="w-32 h-32 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-4xl font-bold animate-pulse">
          {(incoming?.name || "?").charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">
          {incoming?.name || "Incoming call"}
        </h1>
        <p className="text-sm text-white/70 mt-1">
          {incoming
            ? `Incoming ${incoming.type} call…`
            : "Connecting to the call…"}
        </p>
      </div>

      {incoming && matches ? (
        <div className="flex gap-10 mt-2">
          <button
            onClick={() => {
              call.rejectCall();
              navigate("/", { replace: true });
            }}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white"
            aria-label="Decline"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <button
            onClick={() => {
              void call.answerCall();
              navigate("/", { replace: true });
            }}
            className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white animate-pulse"
            aria-label="Answer"
          >
            {incoming.type === "video" ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-white/70 max-w-xs">
          Waiting for the call signal… Make sure you have a stable connection.
          You can return to the app and we'll ring you here as soon as the
          caller is ready.
        </p>
      )}

      <button
        onClick={() => navigate("/", { replace: true })}
        className="mt-4 text-sm text-white/70 underline"
      >
        Back to app
      </button>
    </div>
  );
}