import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PostCard, { FeedPost } from "./PostCard";
import PagePostCard, { PagePostCardData } from "@/components/pages/PagePostCard";
import CommentSheet from "./CommentSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame } from "lucide-react";

const PAGE_SIZE = 15;
const PAGE_FEED_SIZE = 10;
const PREVIEW_USER_SIZE = 8;
const PREVIEW_PAGE_SIZE = 2;

type FeedItem =
  | { kind: "user"; post: FeedPost; sortKey: number }
  | { kind: "page"; post: PagePostCardData; sortKey: number };

interface FeedSectionProps {
  preview?: boolean;
}

export default function FeedSection({ preview = false }: FeedSectionProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetPostId = searchParams.get("post");
  const openComments = searchParams.get("comments") === "1";
  const targetCommentId = searchParams.get("commentId");

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [pagePosts, setPagePosts] = useState<PagePostCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const handledTargetRef = useRef<string | null>(null);

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    const userSize = preview ? PREVIEW_USER_SIZE : PAGE_SIZE;
    const pageSize = preview ? PREVIEW_PAGE_SIZE : PAGE_FEED_SIZE;

    try {
      if (user) {
        const [userRes, pageRes] = await Promise.all([
          supabase.rpc("get_feed_posts", {
            p_user_id: user.id,
            p_limit: userSize,
            p_offset: offset,
          }),
          supabase.rpc("get_page_feed", {
            p_user_id: user.id,
            p_limit: pageSize,
            p_offset: offset,
          }),
        ]);
        if (userRes.error) throw userRes.error;
        const fetched = (userRes.data || []) as unknown as FeedPost[];
        const fetchedPages = (pageRes.data || []) as unknown as PagePostCardData[];
        setPosts((prev) => (append ? [...prev, ...fetched] : fetched));
        setPagePosts((prev) => (append ? [...prev, ...fetchedPages] : fetchedPages));
        setHasMore(!preview && (fetched.length === userSize || fetchedPages.length === pageSize));
      } else {
        // Guest mode: simple public feed (no personalization, no like state)
        const { data: rows, error } = await supabase
          .from("posts")
          .select("id, user_id, content, image_url, likes_count, comments_count, created_at")
          .order("created_at", { ascending: false })
          .range(offset, offset + userSize - 1);
        if (error) throw error;
        const ids = (rows || []).map((r) => r.user_id);
        const { data: profs } = ids.length
          ? await supabase
              .from("profiles")
              .select("user_id, display_name, username, avatar_url, rank")
              .in("user_id", ids)
          : { data: [] as any[] };
        const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
        const fetched: FeedPost[] = (rows || []).map((p: any) => ({
          ...p,
          display_name: profMap.get(p.user_id)?.display_name ?? null,
          username: profMap.get(p.user_id)?.username ?? null,
          avatar_url: profMap.get(p.user_id)?.avatar_url ?? null,
          rank: profMap.get(p.user_id)?.rank ?? null,
          is_liked: false,
          feed_score: 0,
        }));

        // Guest page posts (public)
        const { data: pageRows } = await supabase
          .from("page_posts")
          .select("id, page_id, author_id, content, media_url, media_type, views_count, unique_views_count, likes_count, comments_count, saves_count, created_at")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        const pageIds = (pageRows || []).map((r: any) => r.page_id);
        const { data: pageMeta } = pageIds.length
          ? await supabase.from("pages").select("id, name, profile_image").in("id", pageIds)
          : { data: [] as any[] };
        const pageMap = new Map((pageMeta || []).map((p: any) => [p.id, p]));
        const fetchedPages: PagePostCardData[] = (pageRows || []).map((p: any) => ({
          ...p,
          page_name: pageMap.get(p.page_id)?.name ?? null,
          page_avatar: pageMap.get(p.page_id)?.profile_image ?? null,
          is_followed: false,
          is_boosted: false,
          is_saved: false,
          is_liked: false,
        }));

        setPosts((prev) => (append ? [...prev, ...fetched] : fetched));
        setPagePosts((prev) => (append ? [...prev, ...fetchedPages] : fetchedPages));
        setHasMore(!preview && (fetched.length === userSize || fetchedPages.length === pageSize));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, preview]);

  useEffect(() => {
    fetchPosts(0);
  }, [fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    if (preview) return;
    if (!observerRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          fetchPosts(posts.length, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [posts.length, hasMore, loadingMore, fetchPosts, preview]);

  // Deep-link handler: scroll to + highlight target post
  useEffect(() => {
    if (!targetPostId || loading) return;
    if (handledTargetRef.current === targetPostId) return;

    const scrollToTarget = (id: string) => {
      handledTargetRef.current = id;
      requestAnimationFrame(() => {
        const el = postRefs.current.get(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightId(id);
          setTimeout(() => setHighlightId((curr) => (curr === id ? null : curr)), 2500);
        }
        if (openComments) {
          setCommentPostId(id);
          if (targetCommentId) setHighlightCommentId(targetCommentId);
        }
        const next = new URLSearchParams(searchParams);
        next.delete("post");
        next.delete("comments");
        next.delete("commentId");
        setSearchParams(next, { replace: true });
      });
    };

    const exists = posts.some((p) => p.id === targetPostId);
    if (exists) {
      scrollToTarget(targetPostId);
      return;
    }

    (async () => {
      try {
        const { data: postRow, error } = await supabase
          .from("posts")
          .select("*")
          .eq("id", targetPostId)
          .maybeSingle();
        if (error || !postRow) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url, rank")
          .eq("user_id", postRow.user_id)
          .maybeSingle();

        let isLiked = false;
        if (user) {
          const { data: likeRow } = await supabase
            .from("post_likes")
            .select("id")
            .eq("post_id", targetPostId)
            .eq("user_id", user.id)
            .maybeSingle();
          isLiked = !!likeRow;
        }

        const enriched: FeedPost = {
          id: postRow.id,
          user_id: postRow.user_id,
          content: postRow.content,
          image_url: postRow.image_url,
          likes_count: postRow.likes_count,
          comments_count: postRow.comments_count,
          created_at: postRow.created_at,
          display_name: profile?.display_name ?? null,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          rank: profile?.rank ?? null,
          is_liked: isLiked,
          feed_score: 0,
        };

        setPosts((prev) =>
          prev.some((p) => p.id === enriched.id) ? prev : [enriched, ...prev]
        );
        scrollToTarget(targetPostId);
      } catch {
        // silent
      }
    })();
  }, [targetPostId, user, loading, posts, searchParams, setSearchParams, openComments, targetCommentId]);

  const handleLikeToggle = (postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: liked, likes_count: p.likes_count + (liked ? 1 : -1) }
          : p
      )
    );
  };

  const handleCommentAdded = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
    );
  };

  const handleDelete = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const setPostRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) postRefs.current.set(id, el);
    else postRefs.current.delete(id);
  };

  // Merge user posts and page posts, interleaving by recency (newest first overall,
  // with page-post boosted items floated to top via score from RPC)
  const mergedItems: FeedItem[] = (() => {
    const items: FeedItem[] = [
      ...posts.map((p) => ({
        kind: "user" as const,
        post: p,
        sortKey: new Date(p.created_at).getTime() + (p.feed_score || 0) * 60_000,
      })),
      ...pagePosts.map((p) => ({
        kind: "page" as const,
        post: p,
        sortKey:
          new Date(p.created_at).getTime() +
          (p.is_boosted ? 7 * 24 * 60 * 60 * 1000 : 0),
      })),
    ];
    items.sort((a, b) => b.sortKey - a.sortKey);
    // Deduplicate by id+kind
    const seen = new Set<string>();
    const deduped = items.filter((it) => {
      const key = `${it.kind}-${it.post.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (preview) return deduped.slice(0, PREVIEW_USER_SIZE + PREVIEW_PAGE_SIZE);
    return deduped;
  })();

  if (preview) {
    return (
      <div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : mergedItems.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">
            No community activity yet.
          </p>
        ) : (
          <div className="space-y-3">
            {mergedItems.map((item) =>
              item.kind === "user" ? (
                <PostCard
                  key={`u-${item.post.id}`}
                  post={item.post}
                  onLikeToggle={handleLikeToggle}
                  onCommentOpen={setCommentPostId}
                  onDelete={handleDelete}
                />
              ) : (
                <PagePostCard key={`p-${item.post.id}`} post={item.post} />
              )
            )}
            <CommentSheet
              postId={commentPostId}
              open={!!commentPostId}
              onOpenChange={(open) => {
                if (!open) {
                  setCommentPostId(null);
                  setHighlightCommentId(null);
                }
              }}
              onCommentAdded={handleCommentAdded}
              highlightCommentId={highlightCommentId}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <Flame className="w-5 h-5 text-primary" />
        4GO Feed
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : mergedItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mergedItems.map((item) =>
            item.kind === "user" ? (
              <PostCard
                key={`u-${item.post.id}`}
                ref={setPostRef(item.post.id)}
                post={item.post}
                highlighted={highlightId === item.post.id}
                onLikeToggle={handleLikeToggle}
                onCommentOpen={setCommentPostId}
                onDelete={handleDelete}
              />
            ) : (
              <PagePostCard key={`p-${item.post.id}`} post={item.post} />
            )
          )}
          {hasMore && (
            <div ref={observerRef} className="py-4 flex justify-center">
              {loadingMore && <Skeleton className="h-24 w-full rounded-xl" />}
            </div>
          )}
        </div>
      )}

      <CommentSheet
        postId={commentPostId}
        open={!!commentPostId}
        onOpenChange={(open) => {
          if (!open) {
            setCommentPostId(null);
            setHighlightCommentId(null);
          }
        }}
        onCommentAdded={handleCommentAdded}
        highlightCommentId={highlightCommentId}
      />
    </section>
  );
}
