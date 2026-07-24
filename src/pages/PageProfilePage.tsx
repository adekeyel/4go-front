import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Coins, Settings, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import PagePostComposer from "@/components/pages/PagePostComposer";
import PagePostCard, { PagePostCardData } from "@/components/pages/PagePostCard";
import BoostModal from "@/components/pages/BoostModal";
import { toast } from "sonner";
import UserAvatar from "@/components/UserAvatar";

interface PageRow {
  id: string;
  owner_id: string;
  name: string;
  about: string | null;
  category: string | null;
  profile_image: string | null;
  cover_image: string | null;
  followers_count: number;
  is_monetized: boolean;
}

export default function PageProfilePage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [posts, setPosts] = useState<PagePostCardData[]>([]);
  const [boostPostId, setBoostPostId] = useState<string | null>(null);
  const [tab, setTab] = useState<"posts" | "followers" | "following">("posts");
  const [followers, setFollowers] = useState<any[]>([]);
  const [followingPages, setFollowingPages] = useState<any[]>([]);

  const isOwner = !!user && page?.owner_id === user.id;

  useEffect(() => { if (pageId) load(); /* eslint-disable-next-line */ }, [pageId, user]);

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("pages").select("*").eq("id", pageId!).maybeSingle();
    setPage((p as any) ?? null);
    if (user && p) {
      const { data: f } = await supabase
        .from("page_followers")
        .select("id")
        .eq("user_id", user.id)
        .eq("page_id", pageId!)
        .maybeSingle();
      setFollowing(!!f);
    }
    await loadPosts();
    setLoading(false);
  };

  const loadFollowers = async () => {
    const { data: rows } = await supabase
      .from("page_followers")
      .select("user_id")
      .eq("page_id", pageId!)
      .limit(200);
    const ids = (rows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) { setFollowers([]); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", ids);
    setFollowers(profs ?? []);
  };

  const loadFollowingPages = async () => {
    if (!page) return;
    const { data: follows } = await supabase
      .from("page_followers")
      .select("page_id")
      .eq("user_id", page.owner_id);
    const ids = (follows ?? []).map((f: any) => f.page_id);
    if (ids.length === 0) { setFollowingPages([]); return; }
    const { data: pgs } = await supabase
      .from("pages")
      .select("id, name, profile_image, category")
      .in("id", ids);
    setFollowingPages(pgs ?? []);
  };

  useEffect(() => {
    if (!page) return;
    if (tab === "followers") loadFollowers();
    if (tab === "following") loadFollowingPages();
    // eslint-disable-next-line
  }, [tab, page?.id]);

  const loadPosts = async () => {
    const { data } = await supabase
      .from("page_posts")
      .select("*")
      .eq("page_id", pageId!)
      .order("created_at", { ascending: false });
    if (!data) { setPosts([]); return; }
    let savedIds = new Set<string>();
    if (user) {
      const { data: saves } = await supabase
        .from("post_saves")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", (data as any[]).map((d) => d.id));
      savedIds = new Set((saves ?? []).map((s: any) => s.post_id));
    }
    setPosts(
      (data as any[]).map((d) => ({
        ...d,
        page_name: page?.name ?? null,
        page_avatar: page?.profile_image ?? null,
        is_saved: savedIds.has(d.id),
      })) as PagePostCardData[]
    );
  };

  const toggleFollow = async () => {
    if (!user || !page) return;
    if (following) {
      await supabase.rpc("unfollow_page", { p_user_id: user.id, p_page_id: page.id });
      setFollowing(false);
      setPage({ ...page, followers_count: Math.max(0, page.followers_count - 1) });
    } else {
      await supabase.rpc("follow_page", { p_user_id: user.id, p_page_id: page.id });
      setFollowing(true);
      setPage({ ...page, followers_count: page.followers_count + 1 });
      toast.success(`Following ${page.name}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Skeleton className="h-32 w-full" />
        <div className="p-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></div>
        <BottomNav />
      </div>
    );
  }
  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Page not found.</p>
          <Button onClick={() => navigate("/pages")}>Back to Pages</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold truncate flex-1">{page.name}</h1>
          {isOwner && (
            <button onClick={() => navigate(`/pages/${page.id}/dashboard`)} className="p-2 rounded-full hover:bg-muted">
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <div className="relative w-full aspect-[3/1] bg-muted">
        {page.cover_image && <img src={page.cover_image} alt="" className="w-full h-full object-cover" />}
      </div>

      <div className="px-4 -mt-10 pb-4">
        <div className="flex items-end gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-card border-4 border-card shadow-card shrink-0">
            {page.profile_image
              ? <img src={page.profile_image} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">{page.name[0]}</div>}
          </div>
          <div className="flex-1 mb-1">
            <p className="font-display font-bold text-lg leading-tight">{page.name}</p>
            <p className="text-xs text-muted-foreground">{page.category}</p>
          </div>
          {!isOwner && (
            <Button size="sm" variant={following ? "outline" : "default"} onClick={toggleFollow}>
              {following ? "Following" : "Follow"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {page.followers_count.toLocaleString()} followers</span>
          {page.is_monetized && <span className="flex items-center gap-1 text-amber-600"><Coins className="w-3.5 h-3.5" /> Monetized</span>}
        </div>
        {page.about && <p className="text-sm mt-3 whitespace-pre-wrap">{page.about}</p>}
      </div>

      <div className="flex border-b border-border sticky top-[49px] bg-background/95 backdrop-blur z-[5]">
        {(["posts", "followers", "following"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >{t}</button>
        ))}
      </div>

      {tab === "posts" && (
        <div className="px-4 pt-3 space-y-3">
          {isOwner && (
            <PagePostComposer
              pageId={page.id}
              onPosted={(id) => { loadPosts(); setBoostPostId(id); }}
            />
          )}
          {posts.length === 0
            ? <p className="text-center text-sm text-muted-foreground py-8">No posts yet.</p>
            : posts.map((p) => <PagePostCard key={p.id} post={p} onChange={loadPosts} />)}
        </div>
      )}

      {tab === "followers" && (
        <div className="px-4 pt-3 space-y-2">
          {followers.length === 0
            ? <p className="text-center text-sm text-muted-foreground py-8">No followers yet.</p>
            : followers.map((f) => (
              <button
                key={f.user_id}
                onClick={() => navigate(`/profile/${f.user_id}`)}
                className="w-full flex items-center gap-3 p-2.5 bg-card rounded-xl shadow-card text-left"
              >
                <UserAvatar name={f.display_name} url={f.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{f.display_name || f.username || "User"}</p>
                  {f.username && <p className="text-xs text-muted-foreground truncate">@{f.username}</p>}
                </div>
              </button>
            ))}
        </div>
      )}

      {tab === "following" && (
        <div className="px-4 pt-3 space-y-2">
          {followingPages.length === 0
            ? <p className="text-center text-sm text-muted-foreground py-8">Not following any pages yet.</p>
            : followingPages.map((pg) => (
              <button
                key={pg.id}
                onClick={() => navigate(`/pages/${pg.id}`)}
                className="w-full flex items-center gap-3 p-2.5 bg-card rounded-xl shadow-card text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                  {pg.profile_image ? <img src={pg.profile_image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">{pg.name[0]}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{pg.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{pg.category}</p>
                </div>
              </button>
            ))}
        </div>
      )}

      <BoostModal
        open={!!boostPostId}
        onOpenChange={(o) => { if (!o) setBoostPostId(null); }}
        postId={boostPostId}
        onBoosted={loadPosts}
      />
      <BottomNav />
    </div>
  );
}