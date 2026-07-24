import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Loader2, Shield, ShieldAlert, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import VerifiedIdentityBadge from "@/components/VerifiedIdentityBadge";
import { useVerification } from "@/hooks/useVerification";
import { toast } from "sonner";

const FEE_NGN = 10000;
const ELIGIBLE_RANKS = ["Professional", "Expert", "Master"] as const;

const BENEFITS = [
  { icon: BadgeCheck, title: "Blue verified badge", desc: "Your name shows the official 4GO Verified badge across the app." },
  { icon: Shield, title: "Stronger trust signals", desc: "Receive higher reach and prioritized review on reports against you." },
  { icon: Star, title: "Eligibility for spotlight", desc: "Verified creators are surfaced in discovery and contests." },
];

export default function VerificationPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isVerified, latest, refresh, loading } = useVerification();
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const rank = ((profile as any)?.rank as string | undefined) ?? "Amateur";
  const eligible = ELIGIBLE_RANKS.includes(rank as any);

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
          toast.success("Application submitted — under review");
          void refresh();
        }
      })
      .finally(() => {
        setVerifying(false);
        window.history.replaceState({}, "", "/verification");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const apply = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!eligible) {
      toast.error("Only Professional rank or higher can apply");
      return;
    }
    const email = user.email || (profile?.username ? profile.username + "@4go.com.ng" : null);
    if (!email) {
      toast.error("Add an email to your account first");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: {
        amount: FEE_NGN,
        email,
        userId: user.id,
        purpose: "verification",
        redirectUrl: window.location.origin + "/verification",
      },
    });
    setBusy(false);
    if (error || !data?.link) {
      toast.error("Couldn't start checkout");
      return;
    }
    window.location.href = data.link;
  };

  const statusLabel = (() => {
    if (!latest) return null;
    if (latest.status === "approved") return { color: "text-emerald-600 bg-emerald-500/10", text: "Approved" };
    if (latest.status === "rejected") return { color: "text-destructive bg-destructive/10", text: "Rejected" };
    return { color: "text-amber-700 bg-amber-500/10", text: "Pending review" };
  })();

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold flex-1">Get Verified</h1>
        <VerifiedIdentityBadge size="md" />
      </header>

      <div className="px-4 pt-4 space-y-5">
        <div className="rounded-2xl p-5 text-center bg-gradient-to-br from-sky-300/15 via-blue-500/10 to-indigo-600/15 border border-sky-300/40">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-sky-300 via-blue-500 to-indigo-600 shadow-md mb-2">
            <BadgeCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-display font-bold">
            {isVerified ? "You're Verified" : "4GO Verified Identity"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isVerified
              ? "Your blue badge is active across 4GO."
              : "Stand out with a trusted blue badge — one-time fee, manual review."}
          </p>
          {statusLabel && (
            <span className={`inline-block mt-3 text-[11px] font-semibold rounded-full px-2.5 py-1 ${statusLabel.color}`}>
              {statusLabel.text}
            </span>
          )}
        </div>

        <section className="rounded-2xl bg-card shadow-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-display font-bold">Verification fee</p>
              <p className="text-sm text-muted-foreground">One-time, non-refundable on approval</p>
            </div>
            <p className="text-xl font-display font-bold">₦{FEE_NGN.toLocaleString()}</p>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2 rounded-lg bg-muted/40 p-2">
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Eligibility: Professional rank or higher. Your current rank is{" "}
              <span className="font-semibold text-foreground">{rank}</span>.
              {!eligible && " Keep using 4GO to reach Professional."}
            </span>
          </div>
          <div className="mt-3">
            <Button
              className="w-full"
              disabled={
                busy || verifying || loading || !eligible || isVerified || latest?.status === "pending"
              }
              onClick={() => void apply()}
            >
              {busy || verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isVerified ? (
                "Verified"
              ) : latest?.status === "pending" ? (
                "Application pending"
              ) : latest?.status === "rejected" ? (
                "Re-apply"
              ) : (
                `Apply for verification`
              )}
            </Button>
            {latest?.status === "rejected" && latest.review_notes && (
              <p className="mt-2 text-[11px] text-destructive">
                Reviewer note: {latest.review_notes}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-card shadow-card p-4">
          <h3 className="text-sm font-semibold mb-3">What you get</h3>
          <ul className="space-y-3">
            {BENEFITS.map((p) => (
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
          Payments processed securely via Flutterwave (NGN). If your application is rejected, the fee is refunded as 4GO coins (₦1 = 2 coins).
        </p>
      </div>

      <BottomNav />
    </div>
  );
}