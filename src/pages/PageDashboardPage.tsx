import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Bookmark, Coins, Eye, Rocket, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import BoostModal from "@/components/pages/BoostModal";
import { toast } from "sonner";

interface PostRow {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  views_count: number;
  unique_views_count: number;
  saves_count: number;
  created_at: string;
}
interface BoostRow {
  id: string; post_id: string; plan: string; coins_spent: number;
  reach_target: number; reach_count: number; ends_at: string; status: string;
}

export default function PageDashboardPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pageName, setPageName] = useState("");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [boosts, setBoosts] = useState<BoostRow[]>([]);
  const [boostPostId, setBoostPostId] = useState<string | null>(null);

  useEffect(() => { if (pageId) load(); /* eslint-disable-next-line */ }, [pageId, user]);

  const load = async () => {
    const { data: p } = await supabase.from("pages").select("name, owner_id").eq("id", pageId!).maybeSingle();
    if (!p || (user && (p as any).owner_id !== user.id)) {
      toast.error("Only the owner can view this dashboard");
      navigate(`/pages/${pageId}`);
      return;
    }
    setPageName((p as any).name);
    const { data: po } = await supabase
      .from("page_posts").select("*").eq("page_id", pageId!).order("created_at", { ascending: false });
    setPosts((po as any[]) ?? []);
    const ids = ((po as any[]) ?? []).map((x) => x.id);
    if (ids.length) {
      const { data: b } = await supabase
        .from("post_boosts").select("*").in("post_id", ids).order("created_at", { ascending: false });
      setBoosts((b as any[]) ?? []);
    } else setBoosts([]);
  };

  const totals = posts.reduce(
    (a, p) => ({ views: a.views + p.views_count, unique: a.unique + p.unique_views_count, saves: a.saves + p.saves_count }),
    { views: 0, unique: 0, saves: 0 }
  );
  const activeBoosts = boosts.filter((b) => b.status === "active" && new Date(b.ends_at) > new Date());
  const boostFor = (postId: string) => activeBoosts.find((b) => b.post_id === postId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-lg truncate">{pageName}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Dashboard</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card><CardContent className="p-3 text-center">
            <Eye className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold tabular-nums">{totals.views.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Views</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold tabular-nums">{totals.unique.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Unique</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Bookmark className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold tabular-nums">{totals.saves.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Saves</p>
          </CardContent></Card>
        </div>

        {activeBoosts.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Active boosts</h2>
            <div className="space-y-2">
              {activeBoosts.map((b) => (
                <Card key={b.id}><CardContent className="p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1"><Rocket className="w-3.5 h-3.5 text-primary" /> {b.plan}</span>
                    <span className="text-muted-foreground">Ends {new Date(b.ends_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (b.reach_count / b.reach_target) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                    {b.reach_count.toLocaleString()} / {b.reach_target.toLocaleString()} users reached • <Coins className="inline w-3 h-3 text-amber-500" /> {b.coins_spent.toLocaleString()}
                  </p>
                </CardContent></Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">All posts</h2>
        {posts.length === 0
          ? <p className="text-center text-sm text-muted-foreground py-6">No posts yet.</p>
          : posts.map((p) => {
              const b = boostFor(p.id);
              return (
                <Card key={p.id}><CardContent className="p-3">
                  <div className="flex gap-3">
                    {p.media_url && p.media_type === "image" && (
                      <img src={p.media_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    )}
                    {p.media_url && p.media_type === "video" && (
                      <div className="w-14 h-14 rounded-lg bg-black flex items-center justify-center text-white text-xs shrink-0">▶</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{p.content || "(media post)"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleDateString()} • {p.unique_views_count} unique views
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    {b
                      ? <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary font-bold flex items-center gap-1"><Rocket className="w-3 h-3" /> Boosted</span>
                      : <Button size="sm" variant="outline" onClick={() => setBoostPostId(p.id)}>
                          <Rocket className="w-3.5 h-3.5 mr-1" /> Boost
                        </Button>}
                  </div>
                </CardContent></Card>
              );
            })}
      </div>

      <BoostModal
        open={!!boostPostId}
        onOpenChange={(o) => { if (!o) setBoostPostId(null); }}
        postId={boostPostId}
        onBoosted={load}
      />
      <BottomNav />
    </div>
  );
}