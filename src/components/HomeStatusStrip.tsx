import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import ProfileBadges from "@/components/ProfileBadges";

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Group = { profile: ProfileLite; count: number; lastAt: string };

/**
 * Horizontal strip of friends' status updates, shown on the Home header.
 * RLS already restricts `statuses` to friends + self, non-expired.
 */
export default function HomeStatusStrip() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [hasMine, setHasMine] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from("statuses")
      .select("user_id, created_at")
      .order("created_at", { ascending: false });
    const list = (rows || []) as { user_id: string; created_at: string }[];
    if (list.length === 0) {
      setGroups([]);
      setHasMine(false);
      return;
    }
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", userIds);
    const profMap = new Map((profs || []).map((p) => [p.user_id, p as ProfileLite]));

    const grouped = new Map<string, Group>();
    for (const r of list) {
      const g = grouped.get(r.user_id);
      if (g) {
        g.count += 1;
        if (r.created_at > g.lastAt) g.lastAt = r.created_at;
      } else {
        grouped.set(r.user_id, {
          profile:
            profMap.get(r.user_id) || {
              user_id: r.user_id,
              display_name: null,
              username: null,
              avatar_url: null,
            },
          count: 1,
          lastAt: r.created_at,
        });
      }
    }
    const all = Array.from(grouped.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    setHasMine(grouped.has(user.id));
    setGroups(all.filter((g) => g.profile.user_id !== user.id));
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const ch = supabase
      .channel("home-status-strip")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "statuses" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  return (
    <div className="-mx-5 px-5 mt-3">
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* My status / add */}
        <button
          onClick={() => navigate("/status")}
          className="flex flex-col items-center gap-1 shrink-0 w-16"
          aria-label={hasMine ? "View my status" : "Add a status"}
        >
          <div
            className={`relative p-[2px] rounded-full ${
              hasMine ? "ring-2 ring-primary-foreground/80" : ""
            }`}
          >
            <UserAvatar
              name={profile?.display_name || profile?.username}
              url={profile?.avatar_url}
              size="md"
            />
            {!hasMine && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center">
                <Plus className="w-3 h-3" />
              </span>
            )}
          </div>
          <span className="text-[11px] text-primary-foreground/90 truncate max-w-[64px]">
            {hasMine ? "My status" : "Add"}
          </span>
        </button>

        {groups.map((g) => (
          <button
            key={g.profile.user_id}
            onClick={() => navigate("/status")}
            className="flex flex-col items-center gap-1 shrink-0 w-16"
          >
            <div className="p-[2px] rounded-full ring-2 ring-primary-foreground">
              <UserAvatar
                name={g.profile.display_name || g.profile.username}
                url={g.profile.avatar_url}
                size="md"
              />
            </div>
            <span className="text-[11px] text-primary-foreground/90 truncate max-w-[64px] inline-flex items-center gap-0.5 justify-center">
              {g.profile.display_name || g.profile.username || "User"}
              <ProfileBadges userId={g.profile.user_id} size="xs" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}