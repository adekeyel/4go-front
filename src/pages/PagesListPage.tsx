import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { canCreatePage } from "@/lib/boost";

interface Page {
  id: string;
  name: string;
  category: string | null;
  about: string | null;
  profile_image: string | null;
  cover_image: string | null;
  followers_count: number;
  owner_id: string;
}

export default function PagesListPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"following" | "yours">("following");
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, user]);

  const load = async () => {
    setLoading(true);
    if (tab === "yours") {
      if (!user) { setPages([]); setLoading(false); return; }
      const { data } = await supabase.from("pages").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      setPages((data ?? []) as Page[]);
    } else if (tab === "following") {
      if (!user) { setPages([]); setLoading(false); return; }
      const { data: follows } = await supabase.from("page_followers").select("page_id").eq("user_id", user.id);
      const ids = (follows ?? []).map((f: any) => f.page_id);
      if (ids.length === 0) { setPages([]); setLoading(false); return; }
      const { data } = await supabase.from("pages").select("*").in("id", ids);
      setPages((data ?? []) as Page[]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-lg flex-1">Pages</h1>
          {canCreatePage(profile?.rank) && (
            <Button size="sm" onClick={() => navigate("/pages/new")}>
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          )}
        </div>
        <div className="flex border-b border-border">
          {(["following", "yours"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >{t}</button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : pages.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {tab === "yours"
              ? canCreatePage(profile?.rank)
                ? "You haven't created any pages yet."
                : "Reach Professional rank to create pages."
              : "You're not following any pages yet. Browse pages from the Discover tab."}
          </div>
        ) : (
          pages.map((p) => (
            <Card key={p.id} className="overflow-hidden cursor-pointer" onClick={() => navigate(`/pages/${p.id}`)}>
              <div className="h-20 bg-muted relative">
                {p.cover_image && <img src={p.cover_image} alt="" className="w-full h-full object-cover" />}
              </div>
              <CardContent className="p-3 flex items-start gap-3 -mt-8">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-card border-4 border-card shadow-card shrink-0">
                  {p.profile_image
                    ? <img src={p.profile_image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">{p.name[0]}</div>}
                </div>
                <div className="flex-1 mt-7 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.category}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" /> {p.followers_count.toLocaleString()} followers
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}