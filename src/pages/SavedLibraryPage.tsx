import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as pagesApi from "@/api/pages";
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

  // Runs once per user change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Newest save first, with page name/avatar and your like state attached.
    const merged = (await pagesApi.listSavedPagePosts().catch(() => [])).map((p) => ({ ...p, is_saved: true }));
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