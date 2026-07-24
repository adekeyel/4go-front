import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  admin_added: "Admin added",
  admin_removed: "Admin removed",
  admin_role_changed: "Role changed",
  user_monetized: "User monetized",
  user_unmonetized: "User unmonetized",
  support_reply: "Support reply",
  support_status_open: "Support reopened",
  support_status_escalated: "Support escalated",
  support_status_closed: "Support closed",
  support_status_resolved: "Support resolved",
};

const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace(/_/g, " ");

export default function AuditLogSection({ id }: { id: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data || []) as AuditRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-audit")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_audit_logs" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return [r.actor_name, r.target_label, r.action, JSON.stringify(r.details)]
        .some((f) => f?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{actionLabel(a)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No audit records.</TableCell></TableRow>}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{r.actor_name || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{actionLabel(r.action)}</Badge></TableCell>
                  <TableCell className="text-sm">{r.target_label || (r.target_id ? r.target_id.slice(0, 8) : "—")}</TableCell>
                  <TableCell className="hidden max-w-xs truncate lg:table-cell text-xs text-muted-foreground">
                    {r.details && Object.keys(r.details).length ? JSON.stringify(r.details) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
