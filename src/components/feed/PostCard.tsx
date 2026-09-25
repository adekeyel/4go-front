import { useState, forwardRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { Heart, MessageCircle, MoreHorizontal, Trash2, Share2, Pencil, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RankBadge } from "@/components/RankBadge";
import ProfileBadges from "@/components/ProfileBadges";
import SharePostDialog from "@/components/feed/SharePostDialog";
import { renderRichText } from "@/lib/mentions";
import ExpandablePostText from "@/components/feed/ExpandablePostText";

export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string | null;
  is_liked: boolean;
  feed_score: number;
}

interface PostCardProps {
  post: FeedPost;
  onLikeToggle: (postId: string, liked: boolean) => void;
  onCommentOpen: (postId: string) => void;
  onDelete?: (postId: string) => void;
  highlighted?: boolean;
}

const PostCard = forwardRef<HTMLDivElement, PostCardProps>(function PostCard(
  { post, onLikeToggle, onCommentOpen, onDelete, highlighted },
  ref
) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [toggling, setToggling] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savedContent, setSavedContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const isOwn = user?.id === post.user_id;

  const handleLike = async () => {
    if (!user || toggling) return;
    setToggling(true);

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));

    try {
      const { data, error } = await supabase.rpc("toggle_post_like", {
        p_user_id: user.id,
        p_post_id: post.id,
      });
      if (error) throw error;
      onLikeToggle(post.id, (data as { liked: boolean }).liked);
    } catch {
      setLiked(!newLiked);
      setLikesCount((c) => c + (newLiked ? -1 : 1));
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error("Failed to delete post");
    } else {
      onDelete?.(post.id);
    }
  };

  const handleSaveEdit = async () => {
    if (!user) return;
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast.error("Post cannot be empty");
      return;
    }
    if (trimmed === savedContent) {
      setIsEditing(false);
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("posts")
      .update({ content: trimmed, updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("user_id", user.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Failed to update post");
      return;
    }
    setSavedContent(trimmed);
    setIsEditing(false);
    toast.success("Post updated");
  };

  const cancelEdit = () => {
    setEditContent(savedContent);
    setIsEditing(false);
  };

  return (
    <Card
      ref={ref}
      className={cn(
        "shadow-sm border-0 overflow-hidden transition-shadow scroll-mt-20",
        highlighted && "ring-2 ring-primary shadow-lg"
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar url={post.avatar_url} name={post.display_name || ""} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">
                  {post.display_name || "User"}
                </span>
                <ProfileBadges userId={post.user_id} size="xs" />
                {post.rank && <RankBadge rank={post.rank} size="sm" showLabel={false} />}
              </div>
              <p className="text-xs text-muted-foreground">
                @{post.username || "user"} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          {isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)} disabled={isEditing}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit Post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mb-3 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <ExpandablePostText
            text={savedContent}
            postId={post.id}
            className="text-sm text-foreground whitespace-pre-wrap mb-3 break-words"
            render={(t) =>
              renderRichText(
                t,
                post.username
                  ? { [post.username.toLowerCase()]: { user_id: post.user_id, display_name: post.display_name } }
                  : {}
              )
            }
          />
        )}

        {/* Image */}
        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post"
            className="w-full rounded-lg object-cover max-h-80 mb-3"
            loading="lazy"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 pt-1 border-t border-border">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1.5 text-sm transition-colors pt-2",
              liked ? "text-destructive" : "text-muted-foreground hover:text-destructive"
            )}
          >
            <Heart className={cn("w-4.5 h-4.5", liked && "fill-current")} />
            <span>{likesCount > 0 ? likesCount : ""}</span>
          </button>
          <button
            onClick={() => onCommentOpen(post.id)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors pt-2"
          >
            <MessageCircle className="w-4.5 h-4.5" />
            <span>{post.comments_count > 0 ? post.comments_count : ""}</span>
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors pt-2 ml-auto"
            aria-label="Share post"
          >
            <Share2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </CardContent>
      <SharePostDialog
        postId={post.id}
        postPreview={post.content}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </Card>
  );
});

export default PostCard;
