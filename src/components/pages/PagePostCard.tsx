import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, BookmarkCheck, Download, Eye, Heart, MessageCircle, Rocket, Share2 } from "lucide-react";
import { toast } from "sonner";
import { renderRichText } from "@/lib/mentions";
import CommentSheet from "@/components/feed/CommentSheet";
import SharePostDialog from "@/components/feed/SharePostDialog";
import ExpandablePostText from "@/components/feed/ExpandablePostText";

export interface PagePostCardData {
  id: string;
  page_id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  views_count: number;
  unique_views_count: number;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  created_at: string;
  page_name?: string | null;
  page_avatar?: string | null;
  is_followed?: boolean;
  is_boosted?: boolean;
  is_saved?: boolean;
  is_liked?: boolean;
}

interface Props {
  post: PagePostCardData;
  onChange?: () => void;
}

export default function PagePostCard({ post, onChange }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(!!post.is_saved);
  const [savesCount, setSavesCount] = useState(post.saves_count);
  const [viewed, setViewed] = useState(false);
  const [liked, setLiked] = useState(!!post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [toggling, setToggling] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // record view when post is on screen
  useEffect(() => {
    if (!user || viewed || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !viewed) {
          setViewed(true);
          await supabase.rpc("record_page_post_view", { p_user_id: user.id, p_post_id: post.id });
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [user, viewed, post.id]);

  const toggleSave = async () => {
    if (!user) return;
    if (saved) {
      await supabase.from("post_saves").delete().eq("user_id", user.id).eq("post_id", post.id);
      setSaved(false);
      setSavesCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from("post_saves").insert({ user_id: user.id, post_id: post.id });
      if (!error) {
        setSaved(true);
        setSavesCount((c) => c + 1);
        toast.success("Saved to your library");
      }
    }
    onChange?.();
  };

  const sharePost = async () => {
    setShareOpen(true);
  };

  const handleLike = async () => {
    if (!user || toggling) return;
    setToggling(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    try {
      const { error } = await supabase.rpc("toggle_page_post_like", {
        p_user_id: user.id,
        p_post_id: post.id,
      });
      if (error) throw error;
    } catch {
      setLiked(!newLiked);
      setLikesCount((c) => c + (newLiked ? -1 : 1));
    } finally {
      setToggling(false);
    }
  };

  const downloadAllowed = post.media_type === "image";
  const handleDownload = async () => {
    if (!post.media_url) return;
    try {
      const res = await fetch(post.media_url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `4go-${post.id}.${(post.media_url.split(".").pop() ?? "jpg").split("?")[0]}`;
      a.click();
    } catch { toast.error("Download failed"); }
  };

  return (
    <div ref={ref} className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <Link to={`/pages/${post.page_id}`} className="flex items-center gap-2.5 p-3">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0">
          {post.page_avatar
            ? <img src={post.page_avatar} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">{post.page_name?.[0] ?? "P"}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{post.page_name ?? "Page"}</p>
            {post.is_boosted && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold flex items-center gap-0.5">
                <Rocket className="w-2.5 h-2.5" /> BOOSTED
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{new Date(post.created_at).toLocaleString()}</p>
        </div>
      </Link>

      {post.content && (
        <ExpandablePostText
          text={post.content}
          postId={post.id}
          className="px-3 pb-3 text-sm whitespace-pre-wrap break-words"
          render={(t) => renderRichText(t)}
        />
      )}

      {post.media_url && post.media_type === "image" && (
        <img src={post.media_url} alt="" className="w-full max-h-[480px] object-cover" loading="lazy" />
      )}
      {post.media_url && post.media_type === "video" && (
        <video src={post.media_url} controls controlsList="nodownload" className="w-full max-h-[480px] bg-black" />
      )}

      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 transition-colors ${liked ? "text-destructive" : "hover:text-destructive"}`}
            aria-label="Like"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            <span className="tabular-nums">{likesCount > 0 ? likesCount : ""}</span>
          </button>
          <button
            onClick={() => setCommentsOpen(true)}
            className="flex items-center gap-1 hover:text-primary transition-colors"
            aria-label="Comments"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="tabular-nums">{commentsCount > 0 ? commentsCount : ""}</span>
          </button>
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {post.unique_views_count.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          {downloadAllowed && (
            <button onClick={handleDownload} className="p-2 rounded-full hover:bg-muted" title="Download">
              <Download className="w-4 h-4" />
            </button>
          )}
          <button onClick={sharePost} className="p-2 rounded-full hover:bg-muted" title="Share">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={toggleSave} className="p-2 rounded-full hover:bg-muted" title={saved ? "Saved" : "Save"}>
            {saved
              ? <BookmarkCheck className="w-4 h-4 text-primary" />
              : <Bookmark className="w-4 h-4" />}
          </button>
          <span className="text-[11px] tabular-nums">{savesCount}</span>
        </div>
      </div>

      <CommentSheet
        postId={commentsOpen ? post.id : null}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        onCommentAdded={() => setCommentsCount((c) => c + 1)}
        pageMode
      />
      <SharePostDialog
        postId={post.id}
        postPreview={post.content ?? ""}
        open={shareOpen}
        onOpenChange={setShareOpen}
        pageMode
      />
    </div>
  );
}