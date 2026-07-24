import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PagePostCard, { PagePostCardData } from "@/components/pages/PagePostCard";
import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function PagePostViewPage() {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<PagePostCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!postId) return;
    (async () => {
      const { data } = await supabase
        .from("page_posts")
        .select("*")
        .eq("id", postId)
        .maybeSingle();
      if (!data) { setMissing(true); setLoading(false); return; }
      const { data: page } = await supabase
        .from("pages")
        .select("name, profile_image")
        .eq("id", (data as any).page_id)
        .maybeSingle();
      let isLiked = false, isSaved = false;
      if (user) {
        const { data: like } = await supabase.from("post_likes").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
        isLiked = !!like;
        const { data: save } = await supabase.from("post_saves").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
        isSaved = !!save;
      }
      setPost({
        ...(data as any),
        page_name: page?.name ?? null,
        page_avatar: page?.profile_image ?? null,
        is_followed: false,
        is_boosted: false,
        is_liked: isLiked,
        is_saved: isSaved,
      });
      setLoading(false);
    })();
  }, [postId, user?.id]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-base">Post</h1>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : missing || !post ? (
          <p className="text-center text-sm text-muted-foreground py-12">This post is not available.</p>
        ) : (
          <PagePostCard post={post} />
        )}
      </div>

      <BottomNav />
    </div>
  );
}