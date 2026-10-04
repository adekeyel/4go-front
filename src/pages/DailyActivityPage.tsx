import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as walletApi from "@/api/wallet";
import { apiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Gift, Clock, CheckCircle2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

import BottomNav from "@/components/BottomNav";
import AdBanner from "@/components/AdBanner";
import SponsorGateDialog from "@/components/monetization/SponsorGateDialog";

export default function DailyActivityPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [claimsToday, setClaimsToday] = useState(0);
  const [nextClaimAt, setNextClaimAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [boostStage, setBoostStage] = useState<0 | 1 | 2>(0);
  const [boostCoins, setBoostCoins] = useState(0);

  const fetchClaims = useCallback(async () => {
    try {
      const st = await walletApi.getDailyClaimStatus();
      setClaimsToday(st.claimsToday);
      if (st.nextClaimAt && new Date(st.nextClaimAt) > new Date()) setNextClaimAt(new Date(st.nextClaimAt));
    } catch {
      /* the page still works; the claim button reports any problem */
    }
    setInitialLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchClaims();
  }, [user, fetchClaims]);

  useEffect(() => {
    if (!nextClaimAt) { setCountdown(""); return; }
    const tick = () => {
      const diff = nextClaimAt.getTime() - Date.now();
      if (diff <= 0) { setCountdown(""); setNextClaimAt(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextClaimAt]);

  const handleClaim = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await walletApi.claimDaily();
      setClaimsToday((c) => c + 1);
      setNextClaimAt(new Date(Date.now() + 6 * 3600000));
      refreshProfile();
      // Offer first boost
      setBoostCoins(result.coinsAwarded || 100);
      setBoostStage(1);
      toast({ title: "🎉 Reward Claimed!", description: `You earned ${result.coinsAwarded} coins! Boost it for more?` });
    } catch (err) {
      toast({ title: "Cannot claim", description: apiErrorMessage(err, "Try again in a moment"), variant: "destructive" });
      void fetchClaims(); // pick up the real cooldown from the server
    }
    setLoading(false);
  };

  // Boost reward (after a sponsor visit). The server grants it: once per stage, only after a recent claim.
  const grantBoost = async (stage: 1 | 2, next: 0 | 2) => {
    if (!user) return;
    try {
      const r = await walletApi.boostDailyClaim(stage);
      if (r.coinsAwarded > 0) {
        setBoostCoins((c) => c + r.coinsAwarded);
        toast({ title: "🚀 Boosted!", description: `+${r.coinsAwarded} coins added to your wallet.` });
      }
      await refreshProfile();
      setBoostStage(next);
    } catch (err) {
      toast({ title: "Boost failed", description: apiErrorMessage(err, "Try again"), variant: "destructive" });
      setBoostStage(0);
    }
  };

  const canClaim = claimsToday < 3 && !countdown;

  return (
    <div className="min-h-screen bg-background pb-20">
      
      {/* Header */}
      <div className="gradient-hero px-5 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-primary-foreground" />
          </button>
          <h1 className="text-xl font-display font-bold text-primary-foreground">Daily Activity</h1>
        </div>
        <p className="text-primary-foreground/80 text-sm ml-12">Claim your daily rewards!</p>
      </div>
      <AdBanner />

      <div className="px-4 -mt-3 space-y-4">
        {/* Info Card */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-foreground">Daily Reward</h2>
              <p className="text-sm text-muted-foreground">Earn coins just for being active!</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`rounded-xl p-3 text-center border ${
                  i <= claimsToday
                    ? "bg-primary/10 border-primary/30"
                    : "bg-muted/50 border-border"
                }`}
              >
                {i <= claimsToday ? (
                  <CheckCircle2 className="w-6 h-6 text-primary mx-auto mb-1" />
                ) : (
                  <Coins className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                )}
                <p className="text-xs font-medium text-foreground">Claim {i}</p>
                <p className="text-xs text-muted-foreground">100 coins</p>
              </div>
            ))}
          </div>

          {/* Countdown */}
          {countdown && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-3 mb-4">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Next claim in: </span>
              <span className="text-sm font-bold text-foreground">{countdown}</span>
            </div>
          )}

          {/* Claim Button */}
          <Button
            onClick={handleClaim}
            disabled={!canClaim || loading || initialLoading}
            className="w-full h-12 text-base font-bold rounded-xl"
            size="lg"
          >
            {initialLoading
              ? "Loading..."
              : loading
              ? "Claiming..."
              : claimsToday >= 3
              ? "All rewards claimed today ✅"
              : countdown
              ? "Please wait..."
              : "🎁 Claim Reward"}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            {claimsToday}/3 claims today · 6 hour interval between claims
          </p>
        </div>
      </div>

      <BottomNav />
      <SponsorGateDialog
        open={boostStage === 1}
        title="Boost reward to +100 coins?"
        description={`You have ${boostCoins} coins. Visit our sponsor for an extra +100 coins.`}
        continueLabel="Boost +100"
        cancelLabel="Skip"
        onContinue={() => grantBoost(1, 2)}
        onCancel={() => setBoostStage(0)}
      />
      <SponsorGateDialog
        open={boostStage === 2}
        title="Final boost: +100 more coins?"
        description={`You have ${boostCoins} coins. One more sponsor visit unlocks +100 coins.`}
        continueLabel="Final Boost"
        cancelLabel="Skip"
        onContinue={() => grantBoost(2, 0)}
        onCancel={() => setBoostStage(0)}
      />
    </div>
  );
}
