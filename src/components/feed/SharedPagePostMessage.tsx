import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket } from "lucide-react";

interface Props {
  raw: string | null;
}

interface PagePostInfo {
  id: string;
  page_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  page_name: string | null;
  page_avatar: string | null;
}

/** Renders a forwarded page post inside a chat message bubble. */
export default function SharedPagePostMessage({ raw }: Props) {
  const [post, setPost] = useState<PagePostInfo | null>(null);
  const [note, setNote] = useState<string>("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!raw) return;
    let postId = "";
    let n = "";
    try {
      const parsed = JSON.parse(raw);
      postId = parsed.page_post_id || parsed.post_id;
      n = parsed.note || "";
    } catch {
      setMissing(true);
      return;
    }
    setNote(n);
    (async () => {
      const { data } = await supabase
        .from("page_posts")
        .select("id, page_id, content, media_url, media_type")
        .eq("id", postId)
        .maybeSingle();
      if (!data) { setMissing(true); return; }
      const { data: page } = await supabase
        .from("pages")
        .select("name, profile_image")
        .eq("id", (data as any).page_id)
        .maybeSingle();
      setPost({
        id: (data as any).id,
        page_id: (data as any).page_id,
        content: (data as any).content,
        media_url: (data as any).media_url,
        media_type: (data as any).media_type,
        page_name: page?.name ?? null,
        page_avatar: page?.profile_image ?? null,
      });
    })();
  }, [raw]);

  if (missing) {
    return <p className="text-xs text-muted-foreground italic">Shared page post is unavailable</p>;
  }
  if (!post) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-1">
      {note && <p className="text-sm text-foreground break-words mb-1">{note}</p>}
      <Link
        to={`/post/${post.id}`}
        className="block rounded-xl border border-border bg-background/60 overflow-hidden hover:bg-background transition-colors"
      >
        <div className="flex items-center gap-2 px-2.5 pt-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0">
            {post.page_avatar
              ? <img src={post.page_avatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">{post.page_name?.[0] ?? "P"}</div>}
          </div>
          <p className="text-xs font-semibold text-foreground truncate flex-1">
            {post.page_name || "Page"}
          </p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold flex items-center gap-0.5">
            <Rocket className="w-2.5 h-2.5" /> PAGE
          </span>
        </div>
        {post.content && (
          <p className="px-2.5 pt-1 text-xs text-foreground line-clamp-3 whitespace-pre-wrap">
            {post.content}
          </p>
        )}
        {post.media_url && post.media_type === "image" && (
          <img
            src={post.media_url}
            alt="Shared"
            className="w-full max-h-40 object-cover mt-1.5"
            loading="lazy"
          />
        )}
        {post.media_url && post.media_type === "video" && (
          <video src={post.media_url} className="w-full max-h-40 bg-black mt-1.5" preload="metadata" />
        )}
        <p className="px-2.5 py-1.5 text-[10px] text-primary font-semibold">View page post →</p>
      </Link>
    </div>
  );
}