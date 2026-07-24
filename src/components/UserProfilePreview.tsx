import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "./UserAvatar";
import { RankBadge } from "./RankBadge";
import VerifiedBadge from "./VerifiedBadge";
import PremiumBadge from "./PremiumBadge";
import VerifiedIdentityBadge from "./VerifiedIdentityBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { isSupportAgent } from "@/lib/supportAgents";

interface UserProfilePreviewProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  rank: string;
  is_online: boolean | null;
  total_online_minutes: number;
  is_premium?: boolean | null;
  is_verified?: boolean | null;
}

export default function UserProfilePreview({ userId, open, onOpenChange }: UserProfilePreviewProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);
    const fetchProfile = () => supabase
      .from("profiles")
      .select("display_name, username, avatar_url, bio, rank, is_online, total_online_minutes, is_premium, is_verified")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        setProfile(data as ProfileData | null);
        setLoading(false);
      });
    fetchProfile();
    const channel = supabase
      .channel(`profile-preview-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
        (payload) => {
          setProfile((prev) => ({ ...(prev as ProfileData), ...(payload.new as ProfileData) }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, open]);

  useEffect(() => {
    if (!open) setShowFullImage(false);
  }, [open]);

  // Full-screen image viewer
  if (showFullImage && profile?.avatar_url) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none rounded-none sm:rounded-2xl overflow-hidden flex items-center justify-center">
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={profile.avatar_url}
            alt={profile.display_name || "Profile"}
            className="max-w-full max-h-[85vh] object-contain"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <h3 className="text-white text-lg font-display font-bold text-center">
              {profile.display_name || "User"}
            </h3>
            {profile.username && (
              <p className="text-white/70 text-sm text-center">@{profile.username}</p>
            )}
          </div>
          <DialogHeader className="sr-only">
            <DialogTitle>Profile Picture</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[320px] rounded-2xl p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="gradient-primary h-20 relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 text-primary-foreground/80 hover:text-primary-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 -mt-10">
          {loading ? (
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
              <div className="w-32 h-4 bg-muted rounded animate-pulse" />
            </div>
          ) : profile ? (
            <div className="flex flex-col items-center gap-2">
              {/* Large avatar - click to view full size */}
              <button
                onClick={() => profile.avatar_url && setShowFullImage(true)}
                className={`${profile.avatar_url ? "cursor-pointer" : "cursor-default"} transition-transform hover:scale-105`}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || "User"}
                    className="w-20 h-20 rounded-full object-cover border-4 border-background shadow-elevated"
                  />
                ) : (
                  <UserAvatar
                    name={profile.display_name || profile.username}
                    url={profile.avatar_url}
                    size="lg"
                    className="border-4 border-background shadow-elevated"
                  />
                )}
              </button>

              <div className="text-center mt-1">
                <h3 className="text-lg font-display font-bold text-foreground inline-flex items-center gap-1.5">
                  {profile.display_name || "User"}
                  {isSupportAgent(profile.username) && <VerifiedBadge className="w-4 h-4" />}
                  {profile.is_verified && <VerifiedIdentityBadge size="sm" />}
                  {profile.is_premium && <PremiumBadge size="sm" />}
                </h3>
                {profile.username && (
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                )}
                {isSupportAgent(profile.username) && (
                  <div className="mt-1 flex justify-center">
                    <VerifiedBadge withLabel className="w-3 h-3" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <RankBadge rank={profile.rank || "Amateur"} size="sm" />
                <span
                  className={`text-xs font-medium ${
                    profile.is_online ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {profile.is_online ? "Online" : "Offline"}
                </span>
              </div>

              {profile.bio && (
                <p className="text-sm text-muted-foreground text-center mt-1 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {profile.avatar_url && (
                <button
                  onClick={() => setShowFullImage(true)}
                  className="text-xs text-primary font-medium mt-1 hover:underline"
                >
                  View full photo
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Profile not found</p>
          )}
        </div>

        {/* Hidden DialogTitle for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
