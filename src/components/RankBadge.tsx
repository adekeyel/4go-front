import { cn } from "@/lib/utils";

const RANK_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  Amateur: { color: "text-muted-foreground", icon: "🌱", bg: "bg-muted" },
  Novice: { color: "text-blue-400", icon: "⭐", bg: "bg-blue-500/10" },
  Learner: { color: "text-cyan-400", icon: "📘", bg: "bg-cyan-500/10" },
  Professional: { color: "text-orange-400", icon: "💎", bg: "bg-orange-500/10" },
  Expert: { color: "text-purple-400", icon: "🔮", bg: "bg-purple-500/10" },
  Master: { color: "text-primary", icon: "👑", bg: "bg-primary/10" },
  King: {
    color: "text-amber-300",
    icon: "♛",
    bg: "bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 ring-1 ring-amber-400/40",
  },
};

export const RANK_THRESHOLDS = [
  { rank: "Amateur", minutes: 0 },
  { rank: "Novice", minutes: 120 },         // 2h
  { rank: "Learner", minutes: 900 },        // 15h
  { rank: "Professional", minutes: 7200 },  // 120h
  { rank: "Expert", minutes: 26400 },       // 440h
  { rank: "Master", minutes: 60000 },       // 1000h
  { rank: "King", minutes: 120000 },        // 2000h (2x Master)
];

export const RANK_BENEFITS: Record<string, string[]> = {
  Amateur: ["Amateur badge"],
  Novice: ["Novice badge", "Add friends from rooms", "Voice calls"],
  Learner: ["Learner badge", "Add friends from rooms", "Create rooms", "Voice calls"],
  Professional: ["Professional badge", "All Learner rewards", "Video calls", "Upload videos"],
  Expert: ["Expert badge", "All Professional rewards", "Create 2 private rooms"],
  Master: ["Master badge", "All Expert rewards", "Monetization (earn & withdraw)", "4GO Ambassador tag"],
  King: [
    "Royal King badge ♛",
    "All Master rewards",
    "Earn 1 coin per post view (top rate)",
    "Higher withdrawal limit",
    "Automatic verification",
  ],
};

interface RankBadgeProps {
  rank: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function RankBadge({ rank, size = "sm", showLabel = true, className }: RankBadgeProps) {
  const config = RANK_CONFIG[rank] || RANK_CONFIG.Amateur;
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full font-semibold", config.bg, config.color, sizeClasses[size], className)}>
      <span>{config.icon}</span>
      {showLabel && <span>{rank}</span>}
    </span>
  );
}

interface RankProgressProps {
  rank: string;
  totalMinutes: number;
}

export function RankProgress({ rank, totalMinutes }: RankProgressProps) {
  const currentIdx = RANK_THRESHOLDS.findIndex((t) => t.rank === rank);
  const nextRank = RANK_THRESHOLDS[currentIdx + 1];

  if (!nextRank) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Max rank reached!</span>
          <RankBadge rank="King" />
        </div>
        <div className="h-2 rounded-full bg-primary/20 overflow-hidden">
          <div className="h-full rounded-full bg-primary w-full" />
        </div>
      </div>
    );
  }

  const currentThreshold = RANK_THRESHOLDS[currentIdx].minutes;
  const progress = Math.min(((totalMinutes - currentThreshold) / (nextRank.minutes - currentThreshold)) * 100, 100);
  const hoursLeft = Math.max(0, Math.ceil((nextRank.minutes - totalMinutes) / 60));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <RankBadge rank={rank} />
        <span className="text-muted-foreground">{hoursLeft}h to <RankBadge rank={nextRank.rank} /></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
