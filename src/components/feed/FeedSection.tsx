import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import * as feedApi from "@/api/feed";
import * as pagesApi from "@/api/pages";
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
      // Signed-in users get the ranked feeds. Guests get the newest public posts (the page-post feed needs an account).
      const [fetched, fetchedPages] = await Promise.all([
        feedApi.listFeed(userSize, offset),
        user ? pagesApi.listPageFeed(pageSize, offset).catch(() => []) : Promise.resolve([]),
      ]);
      setPosts((prev) => (append ? [...prev, ...fetched] : fetched));
      setPagePosts((prev) => (append ? [...prev, ...fetchedPages] : fetchedPages));
      setHasMore(!preview && (fetched.length === userSize || fetchedPages.length === pageSize));
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
        const enriched = await feedApi.getPost(targetPostId);

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
