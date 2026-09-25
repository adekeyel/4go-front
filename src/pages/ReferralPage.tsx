import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, Copy, Share2, Users, Coins, Check } from "lucide-react";
import { toast } from "sonner";

interface Referral {
  id: string;
  referred_id: string;
  coins_rewarded: number;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

export default function ReferralPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Get referral code
    const { data: prof } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (prof?.referral_code) {
      setReferralCode(prof.referral_code);
    }

    // Get referrals
    const { data: refs } = await supabase
      .from("referrals")
      .select("id, referred_id, coins_rewarded, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    if (refs && refs.length > 0) {
      const referredIds = refs.map((r) => r.referred_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", referredIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      setReferrals(
        refs.map((r) => ({
          ...r,
          profile: profileMap.get(r.referred_id) || undefined,
        }))
      );
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const shareToWhatsApp = () => {
    const text = `Join me on 4go! Sign up with my referral link and we both get rewarded! 🎉\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, "_blank");
  };

  const shareTwitter = () => {
    const text = `Join me on 4go! Sign up with my referral link 🎉`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`, "_blank");
  };

  const shareTelegram = () => {
    const text = `Join me on 4go! Sign up with my referral link and we both get rewarded! 🎉`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join 4go",
          text: "Join me on 4go! Sign up with my referral link and we both get rewarded! 🎉",
          url: referralLink,
        });
      } catch {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  const totalEarned = referrals.reduce((sum, r) => sum + r.coins_rewarded, 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="gradient-hero px-5 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display font-bold text-primary-foreground">Invite Friends</h1>
        </div>
        <p className="text-primary-foreground/80 text-sm">
          Earn <span className="font-bold text-primary-foreground">500 coins</span> for every friend who signs up!
        </p>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
            <p className="text-[10px] text-muted-foreground">Friends Invited</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <Coins className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalEarned.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Coins Earned</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Your Referral Link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-xs text-foreground truncate font-mono">
              {referralLink}
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 w-10 h-10 rounded-lg bg-primary flex items-center justify-center"
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary-foreground" />
              ) : (
                <Copy className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Code: <span className="font-mono font-bold text-foreground">{referralCode}</span>
          </p>
        </div>

        {/* Share Buttons */}
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Share via</p>
          <div className="grid grid-cols-4 gap-3">
            <button onClick={shareToWhatsApp} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                <span className="text-xl">💬</span>
              </div>
              <span className="text-[10px] text-muted-foreground">WhatsApp</span>
            </button>
            <button onClick={shareFacebook} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                <span className="text-xl">📘</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Facebook</span>
            </button>
            <button onClick={shareTwitter} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center">
                <span className="text-xl">🐦</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Twitter</span>
            </button>
            <button onClick={shareTelegram} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                <span className="text-xl">✈️</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Telegram</span>
            </button>
          </div>
          <button
            onClick={shareNative}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold"
          >
            <Share2 className="w-4 h-4" />
            More Options
          </button>
        </div>

        {/* Referral History */}
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Referral History ({referrals.length})
          </p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs py-6">
              No referrals yet. Share your link to start earning!
            </p>
          ) : (
            <div className="space-y-2">
              {referrals.map((ref) => (
                <div key={ref.id} className="flex items-center gap-3 py-2">
                  <UserAvatar
                    name={ref.profile?.display_name}
                    url={ref.profile?.avatar_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ref.profile?.display_name || "User"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary flex items-center gap-0.5">
                    <Coins className="w-3 h-3 text-yellow-500" />
                    +{ref.coins_rewarded}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
