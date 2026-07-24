import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface UserAvatarProps {
  name?: string | null;
  url?: string | null;
  size?: AvatarSize;
  online?: boolean | null;
  showOnline?: boolean;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-2xl",
};

const dotClasses: Record<AvatarSize, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
  xl: "h-5 w-5",
};

export default function UserAvatar({
  name,
  url,
  size = "md",
  online = false,
  showOnline = false,
  className,
}: UserAvatarProps) {
  const fallback = (name || "?").charAt(0).toUpperCase();

  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(sizeClasses[size], "bg-muted ring-2 ring-card shadow-card")}>
        {url ? <AvatarImage src={url} alt={`${name || "User"} profile photo`} className="object-cover" /> : null}
        <AvatarFallback className="gradient-primary font-display font-bold text-primary-foreground">
          {fallback}
        </AvatarFallback>
      </Avatar>

      {showOnline ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-card",
            dotClasses[size],
            online ? "bg-primary animate-pulse-online" : "bg-muted-foreground/40"
          )}
        />
      ) : null}
    </div>
  );
}