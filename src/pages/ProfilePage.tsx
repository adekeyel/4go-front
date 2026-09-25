import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import BottomNav from "@/components/BottomNav";

import AclibBanner from "@/components/AclibBanner";
import TickerBanner from "@/components/TickerBanner";
import SponsorFooterBanner from "@/components/monetization/SponsorFooterBanner";
import AdSlot from "@/components/ads/AdSlot";
import UserAvatar from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings,
  LogOut,
  Edit2,
  Trophy,
  Camera,
  Award,
  Gift,
  Coins,
  Shield,
  Share2,
  Wallet,
  TrendingUp,
  FileText,
  Bookmark,
  QrCode,
  ChevronRight,
  Crown,
  BadgeCheck,
} from "lucide-react";
import { RankBadge, RankProgress } from "@/components/RankBadge";
import VerifiedBadge from "@/components/VerifiedBadge";
import PremiumBadge from "@/components/PremiumBadge";
import VerifiedIdentityBadge from "@/components/VerifiedIdentityBadge";
import { usePremium } from "@/hooks/usePremium";
import { useVerification } from "@/hooks/useVerification";
import { isSupportAgent } from "@/lib/supportAgents";
import { toast } from "sonner";

interface SectionRowProps {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}

function SectionRow({
  icon: Icon,
  iconClassName,
  label,
  onClick,
  trailing,
  destructive,
}: SectionRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 transition-colors text-left"
    >
      <Icon className={iconClassName ?? "w-5 h-5 text-primary shrink-0"} />
      <span
        className={`flex-1 text-sm font-medium ${
          destructive ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </span>
      {trailing ?? <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

interface SectionProps {
  title?: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="mb-4">
      {title && (
        <p className="px-4 mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      <div className="bg-card rounded-xl shadow-card overflow-hidden divide-y divide-border/60">
        {children}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isPremium } = usePremium();
  const { isVerified, latest: verificationApp } = useVerification();

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_admin_access", { p_user_id: user.id }).then(({ data }) => {
      if (data) setIsAdmin(true);
    });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photo must be under 5MB");
      return;
    }

    setUploadingAvatar(true);
    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast.error("Couldn't upload profile photo");
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Couldn't save profile photo");
    } else {
      await refreshProfile();
      toast.success("Profile photo updated");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadingAvatar(false);
  };

  const coins = profile?.coins || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TickerBanner />
      <AclibBanner />

      {/* Top bar: title + QR + Settings */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Profile</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/referrals")}
            className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Share QR / Referral"
          >
            <QrCode className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Profile hero card (rounded green) */}
      <div className="px-4">
        <div className="rounded-2xl gradient-hero p-4 shadow-elevated">
          <div className="flex items-center gap-3">
            <div className="relative">
              <UserAvatar
                name={profile?.display_name || profile?.username}
                url={profile?.avatar_url}
                size="lg"
                online={profile?.is_online}
                showOnline
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-foreground shadow-card disabled:opacity-60"
                aria-label="Change photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-display font-bold text-primary-foreground inline-flex items-center gap-1.5">
                <span className="truncate">{profile?.display_name || "Anonymous"}</span>
                {isPremium && <PremiumBadge size="sm" />}
                {isVerified && <VerifiedIdentityBadge size="sm" />}
                {isSupportAgent(profile?.username) && (
                  <VerifiedBadge
                    className="w-4 h-4 text-primary-foreground"
                    title="Verified 4GO Support Agent"
                  />
                )}
              </h2>
              {profile?.username && (
                <p className="text-primary-foreground/80 text-xs truncate">
                  @{profile.username}
                </p>
              )}
              <div className="mt-1.5">
                <RankProgress
                  rank={profile?.rank || "Amateur"}
                  totalMinutes={profile?.total_online_minutes || 0}
                />
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-primary-foreground/85">
            {Math.floor((profile?.total_online_minutes || 0) / 60)}h{" "}
            {(profile?.total_online_minutes || 0) % 60}m total online time
          </p>
          {((profile?.rank === "Master") || profile?.is_monetized) && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {profile?.rank === "Master" && (
                <span className="text-[10px] text-primary-foreground bg-primary-foreground/20 rounded-full px-2 py-0.5">
                  🏅 4GO Ambassador
                </span>
              )}
              {profile?.is_monetized && (
                <span className="text-[10px] text-primary-foreground bg-primary-foreground/20 rounded-full px-2 py-0.5">
                  💰 Monetized
                </span>
              )}
            </div>
          )}
        </div>

        {/* Two side-by-side action cards: Wallet & Treasures */}
        <div className="grid grid-cols-2 gap-3 mt-4 mb-5">
          <button
            onClick={() => navigate("/wallet")}
            className="bg-card rounded-xl shadow-card p-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Wallet & History</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-foreground">
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
              {coins.toLocaleString()}
            </div>
          </button>
          <button
            onClick={() => navigate("/treasures")}
            className="bg-card rounded-xl shadow-card p-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Treasures & Gifts</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-foreground">
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
              {coins.toLocaleString()}
            </div>
          </button>
        </div>

        {/* Growth & Earnings */}
        <Section title="Growth & Earnings">
          <SectionRow
            icon={Crown}
            iconClassName="w-5 h-5 text-amber-500 shrink-0"
            label={isPremium ? "Manage 4GO Premium" : "Get 4GO Premium"}
            onClick={() => navigate("/premium")}
            trailing={
              isPremium ? (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 rounded-full px-2 py-0.5">
                  Active
                </span>
              ) : undefined
            }
          />
          <SectionRow
            icon={BadgeCheck}
            iconClassName="w-5 h-5 text-sky-500 shrink-0"
            label={
              isVerified
                ? "Verified Identity"
                : verificationApp?.status === "pending"
                ? "Verification Pending"
                : "Get Verified"
            }
            onClick={() => navigate("/verification")}
            trailing={
              isVerified ? (
                <span className="text-[10px] font-semibold text-sky-600 bg-sky-500/10 rounded-full px-2 py-0.5">
                  Active
                </span>
              ) : verificationApp?.status === "pending" ? (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 rounded-full px-2 py-0.5">
                  Pending
                </span>
              ) : undefined
            }
          />
          <SectionRow
            icon={Share2}
            label="Invite Friends & Earn"
            onClick={() => navigate("/referrals")}
          />
          <SectionRow
            icon={Trophy}
            iconClassName="w-5 h-5 text-accent shrink-0"
            label="Leaderboard"
            onClick={() => navigate("/leaderboard")}
          />
          <SectionRow
            icon={Award}
            label="Ranks & Levels"
            onClick={() => navigate("/ranks")}
          />
          {profile?.is_monetized && (
            <SectionRow
              icon={TrendingUp}
              iconClassName="w-5 h-5 text-emerald-500 shrink-0"
              label="View Analytics"
              onClick={() => navigate("/analytics")}
            />
          )}
        </Section>

        {/* Content */}
        <Section title="Content">
          <SectionRow
            icon={FileText}
            label="Pages"
            onClick={() => navigate("/pages")}
          />
          <SectionRow
            icon={Bookmark}
            label="Saved Library"
            onClick={() => navigate("/saved")}
          />
        </Section>

        {/* Account */}
        <Section title="Account">
          <SectionRow
            icon={Edit2}
            label="Edit Profile"
            onClick={() => navigate("/setup-profile")}
          />
          <SectionRow
            icon={Settings}
            iconClassName="w-5 h-5 text-muted-foreground shrink-0"
            label="Settings"
            onClick={() => navigate("/settings")}
          />
          {isAdmin && (
            <SectionRow
              icon={Shield}
              label="Admin Dashboard"
              onClick={() => navigate("/super-admin")}
            />
          )}
          <SectionRow
            icon={LogOut}
            iconClassName="w-5 h-5 text-destructive shrink-0"
            label="Sign Out"
            onClick={handleLogout}
            destructive
            trailing={<span />}
          />
        </Section>
      </div>

      <SponsorFooterBanner />
      <AdSlot placement="profile" />
      <BottomNav />
    </div>
  );
}
