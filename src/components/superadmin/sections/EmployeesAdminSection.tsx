import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye, Search } from "lucide-react";
import { SectionHeader } from "./primitives";
import EmployeeDashboardSection from "./EmployeeDashboardSection";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface Employee {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  employee_since: string;
  total_invited: number;
  active_7: number;
  active_30: number;
}

type SortKey = "name" | "total_invited" | "active_7" | "active_30" | "employee_since";
const PAGE_SIZE = 10;

const rpc = (n: string, a: object) =>
  (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

export default function EmployeesAdminSection({ id }: { id: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_invited");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth.user?.id ?? null;
    if (!adminId) { setLoading(false); return; }
    const { data, error } = await rpc("admin_list_employees", { p_admin_id: adminId });
    if (error) setError(error.message);
    setEmployees((data as Employee[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openEmployee = (e: Employee) => setSelected(e);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = employees.filter((e) =>
      !q || [e.display_name, e.username, e.phone_number].some((f) => f?.toLowerCase().includes(q)));
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "name": return dir * (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
        case "employee_since": return dir * (new Date(a.employee_since).getTime() - new Date(b.employee_since).getTime());
        default: return dir * ((a[sortKey] as number) - (b[sortKey] as number));
      }
    });
    return list;
  }, [employees, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Employee", "Username", "Phone", "Total invited", "Active 7d", "Active 30d", "Employee since"];
    const body = filtered.map((e) => [
      e.display_name || "", e.username ? `@${e.username}` : "", e.phone_number || "",
      e.total_invited, e.active_7, e.active_30, new Date(e.employee_since).toLocaleDateString(),
    ]);
    downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  };

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", sortKey === k ? "text-primary" : "text-muted-foreground/50")} />
      </button>
    </TableHead>
  );

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All Employees
        </Button>
        <EmployeeDashboardSection
          employeeId={selected.user_id}
          title={selected.display_name || selected.username || "Employee"}
          subtitle={`@${selected.username || "—"} · pipeline & activity`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Employees"
        subtitle={`${filtered.length} employee${filtered.length === 1 ? "" : "s"} · monitor pipelines & activity`}
        action={<Button size="sm" onClick={exportCsv} disabled={filtered.length === 0}><Download className="mr-1.5 h-4 w-4" /> CSV</Button>}
      />
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive shadow-card">{error}</Card>
      )}
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search employees…" className="pl-9" />
      </div>
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="name" label="Employee" />
                <SortHead k="total_invited" label="Invited" />
                <SortHead k="active_7" label="Active · 7d" className="hidden md:table-cell" />
                <SortHead k="active_30" label="Active · 30d" className="hidden md:table-cell" />
                <SortHead k="employee_since" label="Since" className="hidden lg:table-cell" />
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No employees found. Add one from Settings → Admin Accounts with the “Employee” role.
                </TableCell></TableRow>
              )}
              {paged.map((e) => (
                <TableRow key={e.user_id} className="cursor-pointer" onClick={() => openEmployee(e)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar url={e.avatar_url} name={e.display_name || e.username} size="sm" />
                      <div>
                        <p className="font-medium">{e.display_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">@{e.username || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{e.total_invited}</TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums">{e.active_7}</TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums">{e.active_30}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(e.employee_since).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); openEmployee(e); }}>
                      <Eye className="mr-1 h-4 w-4" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
