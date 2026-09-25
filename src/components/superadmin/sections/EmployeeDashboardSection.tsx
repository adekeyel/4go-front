import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserAvatar from "@/components/UserAvatar";
import { Users, UserCheck, Network, Activity, Wifi, CalendarClock, Download, Search } from "lucide-react";
import { SectionHeader, StatTile } from "./primitives";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface Stats {
  total_invited: number;
  active_7: number;
  active_14: number;
  active_21: number;
  active_30: number;
  online_now: number;
  downline: number;
}
interface Invited {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string | null;
  is_online: boolean;
  last_seen: string | null;
  joined_at: string;
  sub_referrals: number;
}
interface Downline {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
  joined_at: string;
  referrer_id: string;
  referrer_name: string | null;
  referrer_username: string | null;
}

const daysAgo = (d: string | null) => {
  if (!d) return Infinity;
  return (Date.now() - new Date(d).getTime()) / 86_400_000;
};

const WINDOW_OPTS = [
  { days: 0, label: "All" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 21, label: "21d" },
  { days: 30, label: "30d" },
];

function ActivityBadge({ lastSeen, online }: { lastSeen: string | null; online: boolean }) {
  if (online) return <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Online</Badge>;
  const d = daysAgo(lastSeen);
  if (d <= 7) return <Badge variant="secondary">Active (7d)</Badge>;
  if (d <= 30) return <Badge variant="outline">Recent (30d)</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const rpc = (n: string, a: object) =>
  (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

export default function EmployeeDashboardSection({
  employeeId,
  title,
  subtitle,
}: {
  employeeId: string;
  title?: string;
  subtitle?: string;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [invited, setInvited] = useState<Invited[]>([]);
  const [downline, setDownline] = useState<Downline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(0);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const caller = auth.user?.id ?? null;
    if (!caller) { setLoading(false); return; }
    const [s, i, d] = await Promise.all([
      rpc("employee_pipeline_stats", { p_caller: caller, p_employee: employeeId }),
      rpc("employee_invited_users", { p_caller: caller, p_employee: employeeId }),
      rpc("employee_downline", { p_caller: caller, p_employee: employeeId }),
    ]);
    if (s.error) setError(s.error.message);
    setStats((s.data as Stats) ?? null);
    setInvited((i.data as Invited[]) ?? []);
    setDownline((d.data as Downline[]) ?? []);
    setLoading(false);
    // Only record when an employee is viewing their OWN pipeline.
    if (caller === employeeId) {
      void rpc("log_employee_activity", { p_employee: caller, p_action: "viewed_dashboard", p_detail: "Viewed own pipeline", p_meta: {} });
    }
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  const inWindow = useCallback(
    (lastSeen: string | null, online: boolean) =>
      windowDays === 0 || online || daysAgo(lastSeen) <= windowDays,
    [windowDays]
  );

  const filteredInvited = useMemo(() => {
    const q = search.toLowerCase().trim();
    return invited.filter((u) =>
      inWindow(u.last_seen, u.is_online) &&
      (!q || [u.display_name, u.username].some((f) => f?.toLowerCase().includes(q))));
  }, [invited, search, inWindow]);

  const filteredDownline = useMemo(() => {
    const q = search.toLowerCase().trim();
    return downline.filter((u) =>
      inWindow(u.last_seen, u.is_online) &&
      (!q || [u.display_name, u.username, u.referrer_name, u.referrer_username].some((f) => f?.toLowerCase().includes(q))));
  }, [downline, search, inWindow]);

  const exportMetrics = () => {
    const header = ["Metric", "Value"];
    const rows: (string | number)[][] = [
      ["Total invited", stats?.total_invited ?? 0],
      ["Online now", stats?.online_now ?? 0],
      ["Active 7 days", stats?.active_7 ?? 0],
      ["Active 14 days", stats?.active_14 ?? 0],
      ["Active 21 days", stats?.active_21 ?? 0],
      ["Active 30 days", stats?.active_30 ?? 0],
      ["Their referrals (downline)", stats?.downline ?? 0],
    ];
    downloadCsv(`pipeline-metrics-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
    if (title) void logExport("metrics");
  };

  const exportInvited = () => {
    const header = ["User", "Username", "Rank", "Status", "Their referrals", "Last seen", "Joined"];
    const body = filteredInvited.map((u) => [
      u.display_name || "", u.username ? `@${u.username}` : "", u.rank || "",
      u.is_online ? "Online" : daysAgo(u.last_seen) <= 30 ? "Recent" : "Inactive",
      u.sub_referrals, fmt(u.last_seen), fmt(u.joined_at),
    ]);
    downloadCsv(`invited-users-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
    void logExport("invited");
  };

  const logExport = async (kind: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const caller = auth.user?.id;
    if (caller && caller === employeeId) {
      void rpc("log_employee_activity", { p_employee: caller, p_action: "exported_csv", p_detail: `Exported ${kind}`, p_meta: {} });
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={title ?? "My Pipeline"}
        subtitle={subtitle ?? "Your invited users and their activity"}
        action={<Button size="sm" variant="outline" onClick={exportMetrics}><Download className="mr-1.5 h-4 w-4" /> Metrics CSV</Button>}
      />

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive shadow-card">{error}</Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total Invited" value={loading ? "…" : stats?.total_invited ?? 0} icon={Users} />
        <StatTile label="Online Now" value={loading ? "…" : stats?.online_now ?? 0} icon={Wifi} />
        <StatTile label="Active · 7 days" value={loading ? "…" : stats?.active_7 ?? 0} icon={Activity} />
        <StatTile label="Active · 14 days" value={loading ? "…" : stats?.active_14 ?? 0} icon={Activity} />
        <StatTile label="Active · 21 days" value={loading ? "…" : stats?.active_21 ?? 0} icon={Activity} />
        <StatTile label="Active · 30 days" value={loading ? "…" : stats?.active_30 ?? 0} icon={CalendarClock} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Activity window:</span>
        <div className="flex flex-wrap gap-1.5">
          {WINDOW_OPTS.map((w) => (
            <Button key={w.days} size="sm" variant={windowDays === w.days ? "default" : "outline"} onClick={() => setWindowDays(w.days)} className="h-8 px-3">
              {w.label}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="h-9 pl-9" />
        </div>
      </div>

      <Tabs defaultValue="invited" className="w-full">
        <TabsList>
          <TabsTrigger value="invited"><UserCheck className="mr-1.5 h-4 w-4" /> Invited Users ({filteredInvited.length})</TabsTrigger>
          <TabsTrigger value="downline"><Network className="mr-1.5 h-4 w-4" /> Their Referrals ({filteredDownline.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invited">
          <div className="mb-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={exportInvited} disabled={filteredInvited.length === 0}><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
          </div>
          <Card className="overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Their Referrals</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                  {!loading && filteredInvited.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No invited users in this window.</TableCell></TableRow>}
                  {filteredInvited.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar url={u.avatar_url} name={u.display_name || u.username} size="sm" />
                          <div>
                            <p className="font-medium">{u.display_name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">@{u.username || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><ActivityBadge lastSeen={u.last_seen} online={u.is_online} /></TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">{u.sub_referrals}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{fmt(u.last_seen)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{fmt(u.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="downline">
          <Card className="overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Referred By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                  {!loading && filteredDownline.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No second-level referrals in this window.</TableCell></TableRow>}
                  {filteredDownline.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar url={u.avatar_url} name={u.display_name || u.username} size="sm" />
                          <div>
                            <p className="font-medium">{u.display_name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">@{u.username || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{u.referrer_name || "Unnamed"}</span>
                        <span className="block text-xs text-muted-foreground">@{u.referrer_username || "—"}</span>
                      </TableCell>
                      <TableCell><ActivityBadge lastSeen={u.last_seen} online={u.is_online} /></TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{fmt(u.last_seen)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{fmt(u.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
