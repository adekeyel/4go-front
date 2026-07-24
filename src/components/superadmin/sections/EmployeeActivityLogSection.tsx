import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import UserAvatar from "@/components/UserAvatar";
import { Download, RotateCw } from "lucide-react";
import { SectionHeader } from "./primitives";
import { downloadCsv } from "@/lib/csv";

interface LogRow {
  id: string;
  employee_id: string;
  employee_name: string | null;
  employee_username: string | null;
  avatar_url: string | null;
  action: string;
  detail: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

interface EmployeeOpt {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  viewed_dashboard: "Viewed dashboard",
  viewed_pipeline: "Viewed pipeline",
  exported_csv: "Exported CSV",
  viewed_employee: "Opened employee",
};
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace(/_/g, " ");

const rpc = (n: string, a: object) =>
  (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

export default function EmployeeActivityLogSection({ id }: { id: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth.user?.id ?? null;
    if (!adminId) { setLoading(false); return; }
    const [logRes, empRes] = await Promise.all([
      rpc("admin_employee_activity_log", {
        p_admin_id: adminId,
        p_employee: employee === "all" ? null : employee,
        p_from: from ? new Date(from).toISOString() : null,
        p_to: to ? new Date(to + "T23:59:59").toISOString() : null,
        p_limit: 1000,
      }),
      rpc("admin_list_employees", { p_admin_id: adminId }),
    ]);
    if (logRes.error) setError(logRes.error.message);
    setRows((logRes.data as LogRow[]) || []);
    setEmployees((empRes.data as EmployeeOpt[]) || []);
    setLoading(false);
  }, [employee, from, to]);

  useEffect(() => { void load(); }, [load]);

  const empName = (e: EmployeeOpt) => e.display_name || e.username || e.user_id.slice(0, 8);

  const exportCsv = () => {
    const header = ["When", "Employee", "Username", "Action", "Detail"];
    const body = rows.map((r) => [
      new Date(r.created_at).toLocaleString(),
      r.employee_name || "",
      r.employee_username ? `@${r.employee_username}` : "",
      actionLabel(r.action),
      r.detail || "",
    ]);
    downloadCsv(`employee-activity-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Employee Activity Log"
        subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"} · monitor what your team does`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}><RotateCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
            <Button size="sm" onClick={exportCsv} disabled={rows.length === 0}><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
          </div>
        }
      />
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive shadow-card">{error}</Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={employee} onValueChange={setEmployee}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{empName(e)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        {(from || to || employee !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setEmployee("all"); setFrom(""); setTo(""); }}>Clear</Button>
        )}
      </div>
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden lg:table-cell">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No activity records for this filter.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar url={r.avatar_url} name={r.employee_name || r.employee_username} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{r.employee_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">@{r.employee_username || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{actionLabel(r.action)}</Badge></TableCell>
                  <TableCell className="hidden max-w-xs truncate lg:table-cell text-xs text-muted-foreground">{r.detail || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
