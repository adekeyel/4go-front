import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

interface App {
  id: string; user_id: string; status: string; created_at: string;
  full_name?: string | null; category?: string | null; type?: string | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

export default function VerificationSection({ id }: { id: string }) {
  const { user } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("verification_applications").select("*").order("created_at", { ascending: false }).limit(200);
    const ids = Array.from(new Set((data || []).map((a) => a.user_id)));
    const map = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,display_name,username,avatar_url").in("user_id", ids);
      (profs || []).forEach((p) => map.set(p.user_id, p));
    }
    setApps((data || []).map((a) => ({ ...a, profile: map.get(a.user_id) })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (a: App, action: "approve" | "reject") => {
    setBusy(true);
    const fn: "approve_verification" | "reject_verification" =
      action === "approve" ? "approve_verification" : "reject_verification";
    const { error } = await supabase.rpc(fn, { p_admin_id: user!.id, p_application_id: a.id, p_notes: undefined });
    setBusy(false);
    if (error) { toast.error(error.message || "Failed"); return; }
    toast.success(action === "approve" ? "Approved" : "Rejected & refunded");
    void load();
  };

  const pending = apps.filter((a) => a.status === "pending");

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={`${pending.length} pending requests`} />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : apps.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground shadow-card">No verification applications yet.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <Card key={a.id} className="space-y-3 p-4 shadow-card">
              <div className="flex items-center gap-3">
                <UserAvatar url={a.profile?.avatar_url} name={a.profile?.display_name || a.profile?.username} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.full_name || a.profile?.display_name || "Applicant"}</p>
                  <p className="truncate text-xs text-muted-foreground">@{a.profile?.username || "—"} · {a.category || a.type || "user"}</p>
                </div>
                <Badge variant={a.status === "pending" ? "default" : "secondary"} className="capitalize">{a.status}</Badge>
              </div>
              {a.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-admin-success text-white hover:bg-admin-success/90" disabled={busy} onClick={() => review(a, "approve")}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" disabled={busy} onClick={() => review(a, "reject")}>
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}