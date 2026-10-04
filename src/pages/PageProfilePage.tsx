import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as pagesApi from "@/api/pages";
import { apiErrorMessage } from "@/lib/apiError";
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
  const [followers, setFollowers] = useState<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const [followingPages, setFollowingPages] = useState<{ id: string; name: string; profile_image: string | null; category: string | null }[]>([]);

  const isOwner = !!user && page?.owner_id === user.id;

  // Runs once per pageId/user change; load() also fetches posts via loadPosts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (pageId) load(); }, [pageId, user]);

  const load = async () => {
    setLoading(true);
    // The page comes with is_followed for the signed-in viewer.
    const p = await pagesApi.getPage(pageId!).catch(() => null);
    setPage(p);
    setFollowing(!!p?.is_followed);
    await loadPosts();
    setLoading(false);
  };

  const loadFollowers = async () => {
    setFollowers(await pagesApi.listFollowers(pageId!).catch(() => []));
  };

  const loadFollowingPages = async () => {
    if (!page) return;
    setFollowingPages(await pagesApi.listOwnerFollowing(page.id).catch(() => []));
  };

  useEffect(() => {
    if (!page) return;
    if (tab === "followers") loadFollowers();
    if (tab === "following") loadFollowingPages();
    // eslint-disable-next-line
  }, [tab, page?.id]);

  const loadPosts = async () => {
    setPosts(await pagesApi.listPagePosts(pageId!).catch(() => []));
  };

  const toggleFollow = async () => {
    if (!user || !page) return;
    try {
      if (following) {
        await pagesApi.unfollowPage(page.id);
        setFollowing(false);
        setPage({ ...page, followers_count: Math.max(0, page.followers_count - 1) });
      } else {
        await pagesApi.followPage(page.id);
        setFollowing(true);
        setPage({ ...page, followers_count: page.followers_count + 1 });
        toast.success(`Following ${page.name}`);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update follow"));
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