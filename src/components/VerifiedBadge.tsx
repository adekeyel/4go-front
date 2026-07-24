import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  /** Tailwind size class for the icon, e.g. 'w-3 h-3' */
  className?: string;
  /** Show 'Verified' label next to icon */
  withLabel?: boolean;
  title?: string;
}

/**
 * Small "Verified Support" badge shown next to support agent names.
 * Render only when the user is in SUPPORT_AGENT_USERNAMES.
 */
export default function VerifiedBadge({
  className,
  withLabel = false,
  title = "Verified 4GO Support",
}: VerifiedBadgeProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center gap-0.5 text-primary",
        withLabel && "px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-semibold"
      )}
    >
      <ShieldCheck className={cn("shrink-0", className || "w-3.5 h-3.5")} />
      {withLabel ? <span>Verified Support</span> : null}
    </span>
  );
}
