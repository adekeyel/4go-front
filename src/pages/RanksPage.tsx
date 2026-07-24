import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Check } from "lucide-react";
import { RankBadge, RANK_THRESHOLDS, RANK_BENEFITS } from "@/components/RankBadge";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";

export default function RanksPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const currentRank = (profile as any)?.rank || "Amateur";
  const currentIdx = RANK_THRESHOLDS.findIndex((t) => t.rank === currentRank);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-hero px-5 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-primary-foreground/80">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-foreground" />
            <h1 className="text-xl font-display font-bold text-primary-foreground">Ranks & Levels</h1>
          </div>
        </div>
        <p className="text-primary-foreground/60 text-xs">Level up by spending active time on 4GO</p>
      </div>

      <div className="px-4 -mt-4 space-y-3">
        {RANK_THRESHOLDS.map((tier, idx) => {
          const isCurrentOrPast = idx <= currentIdx;
          const isCurrent = tier.rank === currentRank;
          const hours = Math.round(tier.minutes / 60);
          const benefits = RANK_BENEFITS[tier.rank] || [];
          const prevHours = idx > 0 ? Math.round(RANK_THRESHOLDS[idx - 1].minutes / 60) : 0;
          const hoursNeeded = hours - prevHours;

          return (
            <div
              key={tier.rank}
              className={`rounded-xl border p-4 transition-all ${
                isCurrent
                  ? "border-primary bg-primary/5 shadow-elevated"
                  : isCurrentOrPast
                  ? "border-primary/30 bg-card"
                  : "border-border bg-card opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RankBadge rank={tier.rank} size="md" />
                  {isCurrent && (
                    <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-semibold">
                      Current
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {idx === 0 ? "Start" : `${hoursNeeded}h active`}
                </span>
              </div>

              <div className="space-y-1.5 mt-3">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2">
                    <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isCurrentOrPast ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
