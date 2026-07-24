import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Bookmark } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import PagePostCard, { PagePostCardData } from "@/components/pages/PagePostCard";

export default function SavedLibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PagePostCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: saves } = await supabase
      .from("post_saves")
      .select("post_id, saved_at")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false });
    const ids = (saves ?? []).map((s: any) => s.post_id);
    if (ids.length === 0) { setItems([]); setLoading(false); return; }
    const { data: posts } = await supabase.from("page_posts").select("*").in("id", ids);
    const pageIds = Array.from(new Set(((posts as any[]) ?? []).map((p) => p.page_id)));
    const { data: pages } = await supabase.from("pages").select("id, name, profile_image").in("id", pageIds);
    const pageMap = new Map<string, any>();
    (pages ?? []).forEach((p: any) => pageMap.set(p.id, p));
    const merged = (posts ?? []).map((p: any) => ({
      ...p,
      page_name: pageMap.get(p.page_id)?.name ?? null,
      page_avatar: pageMap.get(p.page_id)?.profile_image ?? null,
      is_saved: true,
    })) as PagePostCardData[];
    // preserve save order
    const order = new Map(ids.map((id, i) => [id, i]));
    merged.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    setItems(merged);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-lg flex items-center gap-2">
            <Bookmark className="w-5 h-5" /> Saved
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {loading
          ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)
          : items.length === 0
          ? <div className="text-center py-12 text-sm text-muted-foreground">
              No saved posts yet. Tap the bookmark icon on a post to save it.
            </div>
          : items.map((p) => <PagePostCard key={p.id} post={p} onChange={load} />)}
      </div>
      <BottomNav />
    </div>
  );
}