import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BOOST_TIERS, BoostPlan } from "@/lib/boost";
import { Rocket, Coins, Users, Clock, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BoostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string | null;
  onBoosted?: () => void;
}

export default function BoostModal({ open, onOpenChange, postId, onBoosted }: BoostModalProps) {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [purchased, setPurchased] = useState<number | null>(null);
  const [busy, setBusy] = useState<BoostPlan | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("purchased_coins")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setPurchased((data as any)?.purchased_coins ?? 0));
  }, [open, user]);

  const handleBoost = async (plan: BoostPlan, cost: number) => {
    if (!user || !postId) return;
    if ((purchased ?? 0) < cost) {
      toast.error(`Boost requires purchased coins. You need ${cost.toLocaleString()} but have ${(purchased ?? 0).toLocaleString()}.`);
      return;
    }
    setBusy(plan);
    try {
      const { error } = await supabase.rpc("boost_page_post", {
        p_user_id: user.id,
        p_post_id: postId,
        p_plan: plan,
      });
      if (error) throw error;
      toast.success("🚀 Boost activated!");
      await refreshProfile();
      onBoosted?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to boost");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="gradient-hero p-5 text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 text-primary-foreground">
            <Rocket className="w-5 h-5" />
            Boost this post
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80">
            Reach more users instantly. Only purchased coins can be used.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between bg-muted rounded-xl px-3 py-2 text-sm">
            <span className="text-muted-foreground">Purchased coins</span>
            <span className="font-bold text-foreground flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-500" />
              {(purchased ?? 0).toLocaleString()}
            </span>
          </div>

          {(purchased ?? 0) === 0 && (
            <div className="flex gap-2 items-start text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">No purchased coins yet</p>
                <p>Earned coins and gifts can't be used for boosts. Buy coins to start boosting.</p>
                <button
                  onClick={() => { onOpenChange(false); navigate("/wallet"); }}
                  className="underline font-semibold mt-1"
                >
                  Go to Wallet
                </button>
              </div>
            </div>
          )}

          {BOOST_TIERS.map((tier) => {
            const affordable = (purchased ?? 0) >= tier.coins;
            return (
              <div
                key={tier.plan}
                className={`relative rounded-2xl border p-4 transition ${
                  affordable ? "border-border bg-card" : "border-border/50 bg-muted/30"
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                    {tier.badge}
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-lg font-display font-bold text-foreground">
                      <Coins className="w-4 h-4 text-amber-500" />
                      {tier.coins.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {tier.reach.toLocaleString()} users
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {tier.durationLabel}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!affordable || busy !== null}
                    onClick={() => handleBoost(tier.plan, tier.coins)}
                    className="rounded-full shrink-0"
                  >
                    {busy === tier.plan ? <Loader2 className="w-4 h-4 animate-spin" /> : "Boost"}
                  </Button>
                </div>
              </div>
            );
          })}

          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}