import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "xs" | "sm" | "md";
  title?: string;
}

/** Blue crystal verified-identity badge for paid-verified users. */
export default function VerifiedIdentityBadge({
  className,
  size = "sm",
  title = "Verified Identity",
}: Props) {
  const dims =
    size === "xs" ? "w-3.5 h-3.5" : size === "md" ? "w-5 h-5" : "w-4 h-4";
  const icon =
    size === "xs" ? "w-2.5 h-2.5" : size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0",
        "bg-gradient-to-br from-sky-300 via-blue-500 to-indigo-600",
        "shadow-[0_0_6px_hsl(217_91%_60%/0.45)] ring-1 ring-white/40",
        dims,
        className,
      )}
    >
      <BadgeCheck className={cn("text-white drop-shadow-sm", icon)} />
    </span>
  );
}