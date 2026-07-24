import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, AtSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface MentionRow {
  id: string;
  mentioner_id: string;
  source_type: string;
  source_id: string;
  context_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
  mentioner?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

export default function MentionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("mentions")
        .select("*")
        .eq("mentioned_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data || []) as MentionRow[];
      const ids = [...new Set(rows.map((r) => r.mentioner_id))];
      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .in("user_id", ids)
        : { data: [] as any[] };
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setItems(rows.map((r) => ({ ...r, mentioner: map.get(r.mentioner_id) })));
      setLoading(false);

      // Mark all as read
      const unread = rows.filter((r) => !r.read_at).map((r) => r.id);
      if (unread.length) {
        await supabase
          .from("mentions")
          .update({ read_at: new Date().toISOString() })
          .in("id", unread);
      }
    })();
  }, [user?.id]);

  const navTarget = (m: MentionRow) => {
    if (m.source_type === "message" && m.context_id)
      return `/room/${m.context_id}?messageId=${m.source_id}`;
    if (m.source_type === "comment" && m.context_id)
      return `/feed?post=${m.context_id}&comments=1&commentId=${m.source_id}`;
    if (m.source_type === "post" && m.context_id)
      return `/feed?post=${m.context_id}`;
    return "/";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <AtSign className="w-5 h-5 text-primary" />
          <h1 className="text-base font-display font-semibold">Mentions</h1>
        </div>
      </header>

      <div className="p-4 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <AtSign className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No mentions yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">When someone @mentions you, it'll show up here</p>
          </div>
        ) : (
          items.map((m) => (
            <Link
              key={m.id}
              to={navTarget(m)}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-accent/30 transition-colors"
            >
              <UserAvatar url={m.mentioner?.avatar_url || null} name={m.mentioner?.display_name || ""} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{m.mentioner?.display_name || "Someone"}</span>{" "}
                  mentioned you in a {m.source_type}
                </p>
                {m.preview && (
                  <p className="text-xs text-muted-foreground truncate">{m.preview}</p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
