import { Phone, PhoneCall, PhoneMissed, PhoneOff, Video } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type CallLog = Tables<"call_logs">;

interface CallLogSystemMessageProps {
  callLog: CallLog;
  isCurrentUserCaller: boolean;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function CallLogSystemMessage({ callLog, isCurrentUserCaller }: CallLogSystemMessageProps) {
  const direction = isCurrentUserCaller ? "Outgoing" : "Incoming";
  const typeIcon = callLog.call_type === "video" ? Video : Phone;
  const TypeIcon = typeIcon;

  const statusMeta = {
    missed: {
      icon: PhoneMissed,
      title: "📞 Missed call",
      detail: direction,
    },
    answered: {
      icon: PhoneCall,
      title: `✅ Answered ${formatDuration(callLog.duration_seconds || 0)}`,
      detail: direction,
    },
    declined: {
      icon: PhoneOff,
      title: "❌ Declined",
      detail: direction,
    },
    cancelled: {
      icon: PhoneOff,
      title: "📴 Cancelled call",
      detail: direction,
    },
  }[callLog.status as "missed" | "answered" | "declined" | "cancelled"];

  if (!statusMeta) return null;

  const StatusIcon = statusMeta.icon;

  return (
    <div className="flex justify-center py-1">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-xs text-muted-foreground shadow-card">
        <StatusIcon className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">{statusMeta.title}</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <TypeIcon className="h-3 w-3" />
          {statusMeta.detail}
        </span>
      </div>
    </div>
  );
}