import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Bell, Speaker, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { SectionHeader, StatTile } from "./primitives";

interface EmailRow { message_id: string; recipient_email: string; status: string; error_message: string | null; created_at: string; }
interface Delivery { id: string; channel: string; title: string | null; body: string | null; target_count: number; success_count: number; failure_count: number; error_sample: string | null; created_at: string; }

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: "Sent", cls: "bg-primary/15 text-primary border-primary/30" },
    failed: { label: "Failed", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    dlq: { label: "Dropped", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    rate_limited: { label: "Throttled", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

export default function DeliveryStatusSection({ id }: { id: string }) {
  const [hours, setHours] = useState(168);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const [statRes, logRes, delRes] = await Promise.all([
      supabase.rpc("admin_email_campaign_stats", { p_since: since }),
      supabase.from("email_send_log").select("message_id,recipient_email,status,error_message,created_at")
        .eq("template_name", "admin_broadcast").gte("created_at", since).order("created_at", { ascending: false }).limit(400),
      supabase.from("broadcast_deliveries").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    ]);
    const s: Record<string, number> = {};
    for (const r of (statRes.data as { status: string; count: number }[] | null) ?? []) s[r.status] = Number(r.count);
    setStats(s);
    // Dedupe email log by message_id keeping latest (already ordered desc)
    const seen = new Set<string>();
    const deduped: EmailRow[] = [];
    for (const r of (logRes.data as EmailRow[] | null) ?? []) {
      if (seen.has(r.message_id)) continue;
      seen.add(r.message_id);
      deduped.push(r);
    }
    setRows(deduped);
    setDeliveries((delRes.data as Delivery[] | null) ?? []);
    setLoading(false);
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const emailSent = stats.sent ?? 0;
  const emailFailed = (stats.failed ?? 0) + (stats.dlq ?? 0);
  const emailPending = (stats.pending ?? 0) + (stats.rate_limited ?? 0);

  return (
    <div className="space-y-4">
      <SectionHeader title="Delivery Status" subtitle="Success & failure tracking for all broadcasts"
        action={<Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>} />

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <Button key={r.hours} size="sm" variant={hours === r.hours ? "default" : "outline"} onClick={() => setHours(r.hours)}>{r.label}</Button>
        ))}
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email"><Mail className="mr-1.5 h-4 w-4" /> Email</TabsTrigger>
          <TabsTrigger value="push"><Bell className="mr-1.5 h-4 w-4" /> Push</TabsTrigger>
          <TabsTrigger value="announce"><Speaker className="mr-1.5 h-4 w-4" /> In-App</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Delivered" value={emailSent} icon={CheckCircle2} />
            <StatTile label="Failed" value={emailFailed} icon={XCircle} />
            <StatTile label="Pending" value={emailPending} icon={Clock} />
          </div>
          <Card className="shadow-card">
            <div className="border-b p-3 text-sm font-semibold">Recent recipients ({rows.length})</div>
            <ScrollArea className="h-[420px]">
              <div className="divide-y">
                {loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
                {!loading && rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No email campaign activity in this period.</p>}
                {rows.map((r) => (
                  <div key={r.message_id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.recipient_email}</p>
                      {r.error_message && <p className="mt-0.5 break-words text-xs text-destructive">{r.error_message}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    {statusBadge(r.status)}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {(["push", "announce"] as const).map((ch) => {
          const list = deliveries.filter((d) => d.channel === ch);
          return (
            <TabsContent key={ch} value={ch} className="space-y-4">
              <Card className="shadow-card">
                <div className="border-b p-3 text-sm font-semibold">{ch === "push" ? "Push notifications" : "In-app announcements"} ({list.length})</div>
                <ScrollArea className="h-[480px]">
                  <div className="divide-y">
                    {loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
                    {!loading && list.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing sent in this period.</p>}
                    {list.map((d) => (
                      <div key={d.id} className="space-y-1.5 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-medium">{d.title || "(no title)"}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                        </div>
                        {d.body && <p className="line-clamp-2 text-xs text-muted-foreground">{d.body}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">{d.success_count} delivered</Badge>
                          {d.failure_count > 0 && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">{d.failure_count} failed</Badge>}
                          <Badge variant="outline">{d.target_count} targeted</Badge>
                        </div>
                        {d.error_sample && <p className="text-[11px] text-muted-foreground">{d.error_sample}</p>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
