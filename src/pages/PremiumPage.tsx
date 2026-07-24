import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, Loader2, Sparkles, Zap, Shield, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import PremiumBadge from "@/components/PremiumBadge";
import { usePremium } from "@/hooks/usePremium";
import { toast } from "sonner";

const PLANS = [
  {
    key: "monthly" as const,
    label: "Monthly",
    price: 2500,
    suffix: "/month",
    note: "Cancel anytime",
    badge: null as string | null,
  },
  {
    key: "yearly" as const,
    label: "Yearly",
    price: 24000,
    suffix: "/year",
    note: "Save 20% — 2 months free",
    badge: "Best value",
  },
];

const PERKS = [
  { icon: Zap, title: "Ad-free experience", desc: "No banners, no sponsor gates." },
  { icon: Sparkles, title: "Premium chat & profile styles", desc: "Animated accents, exclusive reactions, profile frame." },
  { icon: BarChart3, title: "Enhanced creator tools", desc: "Higher withdrawal limits, stronger engagement weight." },
  { icon: Shield, title: "Priority support & review", desc: "Faster response, faster verification review." },
];

export default function PremiumPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isPremium, plan, currentPeriodEnd, refresh } = usePremium();
  const [busyPlan, setBusyPlan] = useState<"monthly" | "yearly" | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Verify Flutterwave callback
  useEffect(() => {
    const status = searchParams.get("status");
    const transactionId = searchParams.get("transaction_id");
    if (!user || !transactionId) return;
    if (status && status !== "successful" && status !== "completed") {
      toast.error("Payment was not completed");
      return;
    }
    setVerifying(true);
    void supabase.functions
      .invoke("verify-payment", { body: { transactionId, userId: user.id } })
      .then(({ data, error }) => {
        if (error || !data?.success) {
          toast.error("Couldn't verify payment");
        } else {
          toast.success("Premium activated 🎉");
          void refresh();
        }
      })
      .finally(() => {
        setVerifying(false);
        // Strip query params
        window.history.replaceState({}, "", "/premium");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const subscribe = async (planKey: "monthly" | "yearly") => {
    if (!user) {
      navigate("/login");
      return;
    }
    const email = user.email || profile?.username + "@4go.com.ng";
    if (!email) {
      toast.error("Add an email to your account first");
      return;
    }
    const amount = planKey === "yearly" ? 24000 : 2500;
    setBusyPlan(planKey);
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: {
        amount,
        email,
        userId: user.id,
        purpose: "premium",
        plan: planKey,
        redirectUrl: window.location.origin + "/premium",
      },
    });
    setBusyPlan(null);
    if (error || !data?.link) {
      toast.error("Couldn't start checkout");
      return;
    }
    window.location.href = data.link;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold flex-1">4GO Premium</h1>
        <PremiumBadge size="md" />
      </header>

      <div className="px-4 pt-4 space-y-5">
        <div className="rounded-2xl p-5 text-center bg-gradient-to-br from-amber-300/15 via-yellow-400/10 to-fuchsia-500/15 border border-amber-300/40">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-fuchsia-500 shadow-md mb-2">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-display font-bold">
            {isPremium ? "You're Premium" : "Unlock 4GO Premium"}
          </h2>
          {isPremium ? (
            <p className="text-sm text-muted-foreground mt-1">
              {plan === "yearly" ? "Yearly" : "Monthly"} plan · renews {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : "—"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Cleaner browsing, stronger creator tools, and exclusive style.
            </p>
          )}
        </div>

        <section className="space-y-3">
          {PLANS.map((p) => {
            const isCurrent = isPremium && plan === p.key;
            return (
              <div
                key={p.key}
                className={`rounded-2xl border bg-card shadow-card p-4 flex items-center justify-between gap-3 ${
                  p.key === "yearly" ? "border-primary/40" : "border-border"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-display font-bold">{p.label}</p>
                    {p.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-0.5">
                    <span className="font-bold">₦{p.price.toLocaleString()}</span>
                    <span className="text-muted-foreground">{p.suffix}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{p.note}</p>
                </div>
                <Button
                  size="sm"
                  disabled={busyPlan !== null || verifying || isCurrent}
                  onClick={() => void subscribe(p.key)}
                  className={p.key === "yearly" ? "" : "variant-secondary"}
                  variant={p.key === "yearly" ? "default" : "secondary"}
                >
                  {busyPlan === p.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    "Current"
                  ) : isPremium ? (
                    "Switch"
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl bg-card shadow-card p-4">
          <h3 className="text-sm font-semibold mb-3">What you get</h3>
          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <p.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <Check className="w-4 h-4 text-primary mt-2 ml-auto shrink-0" />
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[11px] text-center text-muted-foreground">
          Payments processed securely via Flutterwave (NGN). You can cancel anytime — your benefits stay until the period ends.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}