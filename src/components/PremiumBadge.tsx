import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md";
  title?: string;
}

/**
 * Small gold→purple gradient crown badge shown next to premium users' names.
 * Tooltip text defaults to "4GO Premium".
 */
export default function PremiumBadge({
  className,
  size = "sm",
  title = "4GO Premium",
}: PremiumBadgeProps) {
  const dims =
    size === "xs"
      ? "w-3.5 h-3.5"
      : size === "md"
      ? "w-5 h-5"
      : "w-4 h-4";
  const icon =
    size === "xs" ? "w-2 h-2" : size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0",
        "bg-gradient-to-br from-amber-300 via-yellow-400 to-fuchsia-500",
        "shadow-[0_0_6px_hsl(var(--primary)/0.35)] ring-1 ring-white/40",
        dims,
        className,
      )}
    >
      <Crown className={cn("text-white drop-shadow-sm", icon)} />
    </span>
  );
}