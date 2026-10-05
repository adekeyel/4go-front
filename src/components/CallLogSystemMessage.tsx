import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Video } from "lucide-react";
import { Tables } from "@/types/database";

type CallLog = Tables<"call_logs">;

interface CallLogSystemMessageProps {
  callLog: CallLog;
  isCurrentUserCaller: boolean;
}

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = hrs > 0 ? mins.toString().padStart(2, "0") : String(mins);
  return `${hrs > 0 ? `${hrs}:` : ""}${mm}:${secs.toString().padStart(2, "0")}`;
}

/**
 * One line in the chat for each finished call, the way WhatsApp shows it:
 *   "Voice call  Outgoing · 2:31", "Missed voice call", "No answer", "Call declined" ...
 * A call the other person hung up on before you answered counts as missed for YOU (but "cancelled" for them).
 * Calls that are still ringing aren't shown; they appear once they finish.
 */
export default function CallLogSystemMessage({ callLog, isCurrentUserCaller }: CallLogSystemMessageProps) {
  const kind = callLog.call_type === "video" ? "Video" : "Voice";
  const TypeIcon = callLog.call_type === "video" ? Video : Phone;
  const direction = isCurrentUserCaller ? "Outgoing" : "Incoming";
  const seconds = callLog.duration_seconds || 0;

  let Icon = isCurrentUserCaller ? PhoneOutgoing : PhoneIncoming;
  let title = `${kind} call`;
  let detail = direction;
  let missed = false;

  switch (callLog.status) {
    case "answered":
      detail = seconds > 0 ? `${direction} · ${formatDuration(seconds)}` : direction;
      break;
    case "missed":
      if (isCurrentUserCaller) { Icon = PhoneOutgoing; title = "No answer"; detail = `${kind} call`; }
      else { Icon = PhoneMissed; title = `Missed ${kind.toLowerCase()} call`; detail = "Incoming"; missed = true; }
      break;
    case "cancelled":
      if (isCurrentUserCaller) { Icon = PhoneOff; title = "Cancelled call"; detail = `${kind} call`; }
      else { Icon = PhoneMissed; title = `Missed ${kind.toLowerCase()} call`; detail = "Incoming"; missed = true; }
      break;
    case "declined":
      Icon = PhoneOff;
      title = isCurrentUserCaller ? "Call declined" : "You declined";
      detail = `${kind} call`;
      break;
    default:
      return null; // "ringing", or a status this version doesn't know
  }

  return (
    <div className="flex justify-center py-1">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-xs text-muted-foreground shadow-card">
        <Icon className={`h-3.5 w-3.5 ${missed ? "text-destructive" : "text-primary"}`} />
        <span className={`font-medium ${missed ? "text-destructive" : "text-foreground"}`}>{title}</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <TypeIcon className="h-3 w-3" />
          {detail}
        </span>
      </div>
    </div>
  );
}
