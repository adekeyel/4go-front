import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Wifi, Activity, CalendarClock, Download, Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { SectionHeader, StatTile } from "./primitives";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface Windows {
  total_users: number;
  online_now: number;
  active_7: number;
  active_14: number;
  active_21: number;
  active_30: number;
}

interface ActiveUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  last_seen: string | null;
}

const WINDOWS: { key: keyof Windows; label: string; days: number; icon: typeof Users }[] = [
  { key: "online_now", label: "Online Now", days: 0, icon: Wifi },
  { key: "active_7", label: "Active · 7 days", days: 7, icon: Activity },
  { key: "active_14", label: "Active · 14 days", days: 14, icon: Activity },
  { key: "active_21", label: "Active · 21 days", days: 21, icon: Activity },
  { key: "active_30", label: "Active · 30 days", days: 30, icon: CalendarClock },
];

const PAGE_SIZE = 20;
type SortKey = "name" | "last_seen";

const rpc = (n: string, a: object) =>
  (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

export default function ActiveUsersSection({ id }: { id: string }) {
  const [data, setData] = useState<Windows | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [list, setList] = useState<ActiveUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last_seen");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth.user?.id ?? null;
    if (!adminId) { setLoading(false); return; }
    const { data: res, error } = await rpc("admin_active_users_windows", { p_admin_id: adminId });
    if (error) setError(error.message);
    setData((res as Windows) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadList = useCallback(async (days: number, label: string) => {
    setSelected(days);
    setSelectedLabel(label);
    setListLoading(true);
    setList([]);
    setSearch("");
    setPage(0);
    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth.user?.id ?? null;
    if (!adminId) { setListLoading(false); return; }
    const { data: res, error } = await rpc("admin_active_users_list", { p_admin_id: adminId, p_days: days });
    if (error) setError(error.message);
    setList((res as ActiveUser[]) ?? []);
    setListLoading(false);
  }, []);

  const pct = (n?: number) =>
    data && data.total_users > 0 && n != null ? `${Math.round((n / data.total_users) * 100)}% of users` : "";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let out = list.filter((u) => !q || [u.display_name, u.username].some((f) => f?.toLowerCase().includes(q)));
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sortKey === "name") return dir * (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
      return dir * ((a.last_seen ? new Date(a.last_seen).getTime() : 0) - (b.last_seen ? new Date(b.last_seen).getTime() : 0));
    });
    return out;
  }, [list, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
    setPage(0);
  };

  const exportCsv = () => {
    const header = ["Name", "Username", "Status", "Last seen"];
    const body = filtered.map((u) => [
      u.display_name || "", u.username ? `@${u.username}` : "",
      u.is_online ? "Online" : "Offline",
      u.last_seen ? new Date(u.last_seen).toLocaleString() : "",
    ]);
    const slug = selectedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadCsv(`active-users-${slug}-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Active Users" subtitle="Tap a window to see active user names" />
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive shadow-card">{error}</Card>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total Users" value={loading ? "…" : data?.total_users ?? 0} icon={Users} />
        {WINDOWS.map((w) => {
          const Icon = w.icon;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() => void loadList(w.days, w.label)}
              className={`rounded-lg text-left transition-all ${selected === w.days ? "ring-2 ring-primary" : ""}`}
            >
              <Card className="p-4 shadow-card hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{w.label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">{loading ? "…" : data?.[w.key] ?? 0}</p>
              </Card>
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <Card className="p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{selectedLabel} — {listLoading ? "…" : `${filtered.length} user${filtered.length === 1 ? "" : "s"}`}</p>
            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search…" className="h-9 pl-9" />
              </div>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
            </div>
          </div>
          <div className="mb-2 flex gap-3 text-xs">
            <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              Name <ArrowUpDown className={cn("h-3 w-3", sortKey === "name" && "text-primary")} />
            </button>
            <button type="button" onClick={() => toggleSort("last_seen")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              Last seen <ArrowUpDown className={cn("h-3 w-3", sortKey === "last_seen" && "text-primary")} />
            </button>
          </div>
          {listLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active users in this window.</p>
          ) : (
            <>
              <div className="space-y-2">
                {paged.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-3 rounded-lg border p-2">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback>{(u.display_name || u.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.display_name || "Unknown"}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.username ? `@${u.username}` : "—"}</p>
                    </div>
                    <div className="text-right">
                      {u.is_online ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {u.last_seen ? `${formatDistanceToNow(new Date(u.last_seen))} ago` : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {pageCount > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {!loading && data && (
        <Card className="p-4 shadow-card">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-muted-foreground">Last 7 days</p><p className="font-medium">{pct(data.active_7)}</p></div>
            <div><p className="text-muted-foreground">Last 14 days</p><p className="font-medium">{pct(data.active_14)}</p></div>
            <div><p className="text-muted-foreground">Last 21 days</p><p className="font-medium">{pct(data.active_21)}</p></div>
            <div><p className="text-muted-foreground">Last 30 days</p><p className="font-medium">{pct(data.active_30)}</p></div>
          </div>
        </Card>
      )}
    </div>
  );
}
