import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import UserAvatar from "@/components/UserAvatar";
import ProfileBadges from "@/components/ProfileBadges";
import MentionTextarea from "@/components/MentionTextarea";
import { Send, Reply, Pencil, Trash2, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { renderRichText, extractMentionHandles } from "@/lib/mentions";
import { useMentionRecorder } from "@/hooks/useMentionRecorder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Profile { display_name: string | null; avatar_url: string | null; username: string | null; user_id: string }
interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  edited_at: string | null;
  profile?: Profile;
  children?: Comment[];
}

interface CommentSheetProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentAdded: (postId: string) => void;
  highlightCommentId?: string | null;
  /** When true, use page-post RPCs and update page_posts counters. */
  pageMode?: boolean;
}

export default function CommentSheet({ postId, open, onOpenChange, onCommentAdded, highlightCommentId, pageMode }: CommentSheetProps) {
  const { user } = useAuth();
  const { recordFromText } = useMentionRecorder();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const handledHighlightRef = useRef<string | null>(null);

  const fetchComments = async () => {
    if (!postId) return;
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (!data) return;
    const userIds = [...new Set(data.map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, username")
      .in("user_id", userIds);
    const pmap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p])) as Record<string, Profile>;
    setProfileMap(pmap);
    const flat: Comment[] = (data as any[]).map((c) => ({ ...c, profile: pmap[c.user_id], children: [] }));
    // Build tree
    const map = new Map(flat.map((c) => [c.id, c]));
    const roots: Comment[] = [];
    for (const c of flat) {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children!.push(c);
      } else {
        roots.push(c);
      }
    }
    setComments(roots);
  };

  useEffect(() => {
    if (!postId || !open) return;
    setLoading(true);
    setReplyTo(null);
    setEditing(null);
    setText("");
    handledHighlightRef.current = null;
    fetchComments().finally(() => {
      setLoading(false);
      // Default scroll to bottom unless we have a highlight target
      if (!highlightCommentId) {
        setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 100);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, open]);

  // Scroll-to + highlight a specific comment when requested
  useEffect(() => {
    if (!open || !highlightCommentId || loading) return;
    if (handledHighlightRef.current === highlightCommentId) return;
    requestAnimationFrame(() => {
      const el = commentRefs.current.get(highlightCommentId);
      if (!el) return;
      handledHighlightRef.current = highlightCommentId;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(highlightCommentId);
      setTimeout(() => {
        setHighlightedId((curr) => (curr === highlightCommentId ? null : curr));
      }, 2500);
    });
  }, [open, highlightCommentId, loading, comments]);

  const setCommentRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) commentRefs.current.set(id, el);
    else commentRefs.current.delete(id);
  };

  const handleSend = async () => {
    if (!user || !postId || !text.trim() || sending) return;
    setSending(true);
    try {
      if (editing) {
        const { error } = await supabase.rpc("edit_post_comment", {
          p_user_id: user.id,
          p_comment_id: editing.id,
          p_content: text.trim(),
        });
        if (error) throw error;
        await recordFromText(text.trim(), {
          sourceType: "comment",
          sourceId: editing.id,
          contextId: postId,
        });
        toast.success("Comment updated");
      } else {
        const rpcName = pageMode ? "add_page_post_comment" : "add_post_comment";
        const { data: newId, error } = await supabase.rpc(rpcName as any, {
          p_user_id: user.id,
          p_post_id: postId,
          p_content: text.trim(),
          p_parent_id: replyTo?.id ?? null,
        });
        if (error) throw error;
        if (typeof newId === "string") {
          await recordFromText(text.trim(), {
            sourceType: "comment",
            sourceId: newId,
            contextId: postId,
          });
        }
        onCommentAdded(postId);
      }
      setText("");
      setReplyTo(null);
      setEditing(null);
      await fetchComments();
      setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 100);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (c: Comment) => {
    if (!user || c.user_id !== user.id) return;
    if (!window.confirm("Delete this comment?")) return;
    const { error } = await supabase.from("post_comments").delete().eq("id", c.id);
    if (error) { toast.error("Couldn't delete"); return; }
    if (postId) {
      const table = pageMode ? "page_posts" : "posts";
      await supabase
        .from(table as any)
        .select("comments_count")
        .eq("id", postId)
        .maybeSingle()
        .then(async ({ data }) => {
          if (data) await supabase.from(table as any).update({ comments_count: Math.max(((data as any).comments_count || 1) - 1, 0) }).eq("id", postId);
        });
    }
    fetchComments();
  };

  const startEdit = (c: Comment) => {
    setEditing({ id: c.id, content: c.content });
    setReplyTo(null);
    setText(c.content);
  };

  const cancelEdit = () => { setEditing(null); setText(""); };

  // Build mentionMap for rendering existing mentions in comments
  const renderMap: Record<string, { user_id: string; display_name?: string | null }> = {};
  Object.values(profileMap).forEach((p) => {
    if (p.username) renderMap[p.username.toLowerCase()] = { user_id: p.user_id, display_name: p.display_name };
  });

  const renderComment = (c: Comment, depth: number) => (
    <div
      key={c.id}
      ref={setCommentRef(c.id)}
      className={cn(
        "flex gap-2.5 rounded-lg transition-colors scroll-mt-4 -mx-1 px-1 py-1",
        highlightedId === c.id && "bg-primary/10 ring-1 ring-primary/40"
      )}
      style={{ paddingLeft: Math.min(depth, 5) * 16 + 4 }}
    >
      <UserAvatar url={c.profile?.avatar_url} name={c.profile?.display_name || ""} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
            {c.profile?.display_name || "User"}
            <ProfileBadges userId={c.user_id} size="xs" />
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
          </span>
          {c.edited_at && <span className="text-[10px] text-muted-foreground italic">edited</span>}
        </div>
        <p className="text-sm text-foreground mt-0.5 break-words whitespace-pre-wrap">
          {renderRichText(c.content, renderMap)}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => { setReplyTo(c); setEditing(null); setText(""); }}
            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <Reply className="w-3 h-3" /> Reply
          </button>
          {user?.id === c.user_id && (
            <>
              <button
                onClick={() => startEdit(c)}
                className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => handleDelete(c)}
                className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </>
          )}
        </div>
        {c.children && c.children.length > 0 && (
          <div className="mt-3 space-y-3 border-l border-border pl-2">
            {c.children.map((child) => renderComment(child, depth + 1))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <SheetTitle className="text-base font-display">Comments</SheetTitle>
        </SheetHeader>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => renderComment(c, 0))
          )}
        </div>

        {user && (
          <div className="border-t border-border px-3 py-2 space-y-2">
            {(replyTo || editing) && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-primary/10 border-l-2 border-primary">
                <span className="text-[11px] text-primary font-semibold">
                  {editing ? "Editing comment" : `Replying to ${replyTo?.profile?.display_name || "User"}`}
                </span>
                <button
                  onClick={() => { setReplyTo(null); cancelEdit(); }}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <MentionTextarea
                value={text}
                onChange={setText}
                onSubmit={handleSend}
                placeholder={editing ? "Edit your comment..." : replyTo ? "Write a reply..." : "Write a comment..."}
                maxLength={500}
                roomId={null}
              />
              <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()}>
                {editing ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
