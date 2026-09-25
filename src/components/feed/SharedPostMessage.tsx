import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import ProfileBadges from "@/components/ProfileBadges";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  raw: string | null;
}

interface PostInfo {
  id: string;
  content: string;
  image_url: string | null;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

/** Renders a forwarded post inside a chat message bubble. */
export default function SharedPostMessage({ raw }: Props) {
  const [post, setPost] = useState<PostInfo | null>(null);
  const [note, setNote] = useState<string>("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!raw) return;
    let postId = "";
    let n = "";
    try {
      const parsed = JSON.parse(raw);
      postId = parsed.post_id;
      n = parsed.note || "";
    } catch {
      setMissing(true);
      return;
    }
    setNote(n);
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, content, image_url, user_id")
        .eq("id", postId)
        .maybeSingle();
      if (!data) { setMissing(true); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", data.user_id)
        .maybeSingle();
      setPost({
        id: data.id,
        content: data.content,
        image_url: data.image_url,
        user_id: data.user_id,
        display_name: prof?.display_name || null,
        username: prof?.username || null,
        avatar_url: prof?.avatar_url || null,
      });
    })();
  }, [raw]);

  if (missing) {
    return <p className="text-xs text-muted-foreground italic">Shared post is unavailable</p>;
  }
  if (!post) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-1">
      {note && <p className="text-sm text-foreground break-words mb-1">{note}</p>}
      <Link
        to={`/feed?post=${post.id}`}
        className="block rounded-xl border border-border bg-background/60 overflow-hidden hover:bg-background transition-colors"
      >
        <div className="flex items-center gap-2 px-2.5 pt-2">
          <UserAvatar url={post.avatar_url} name={post.display_name || ""} size="sm" />
          <p className="text-xs font-semibold text-foreground truncate inline-flex items-center gap-1">
            {post.display_name || "User"}
            <ProfileBadges userId={post.user_id} size="xs" />
          </p>
        </div>
        {post.content && (
          <p className="px-2.5 pt-1 text-xs text-foreground line-clamp-3 whitespace-pre-wrap">
            {post.content}
          </p>
        )}
        {post.image_url && (
          <img
            src={post.image_url}
            alt="Shared"
            className="w-full max-h-40 object-cover mt-1.5"
            loading="lazy"
          />
        )}
        <p className="px-2.5 py-1.5 text-[10px] text-primary font-semibold">View on 4GO Feed →</p>
      </Link>
    </div>
  );
}
