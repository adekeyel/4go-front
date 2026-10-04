import { useCallback, useEffect, useState } from "react";
import * as adminApi from "@/api/admin";
import { apiErrorMessage } from "@/lib/apiError";
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
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

export default function VerificationSection({ id }: { id: string }) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // The backend returns each application with the applicant's profile, at most 100 per request.
    const first = await adminApi.listVerificationApplications<App>({ limit: 100, offset: 0 }).catch(() => [] as App[]);
    const more = first.length === 100
      ? await adminApi.listVerificationApplications<App>({ limit: 100, offset: 100 }).catch(() => [] as App[])
      : [];
    setApps([...first, ...more]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (a: App, action: "approve" | "reject") => {
    setBusy(true);
    try {
      if (action === "approve") await adminApi.approveVerification(a.id);
      else await adminApi.rejectVerification(a.id);
    } catch (e) {
      setBusy(false);
      toast.error(apiErrorMessage(e, "Failed"));
      return;
    }
    setBusy(false);
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