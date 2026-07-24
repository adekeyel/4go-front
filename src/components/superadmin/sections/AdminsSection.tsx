import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import { ShieldPlus, Trash2, Search } from "lucide-react";
import { SectionHeader } from "./primitives";
import { navItemLabel, ROLE_LABELS, type AdminRoleKey } from "../adminNav";
import { AdminUser } from "../useAdminData";

interface AdminRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  role: AdminRoleKey;
  admin_since: string;
}

export default function AdminsSection({ id, users }: { id: string; users: AdminUser[] }) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [newRole, setNewRole] = useState<AdminRoleKey>("moderator");

  // Call as a method on `supabase` so the client keeps its internal `this` binding.
  const rpc = (n: string, a: object) =>
    (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id ?? null;
    setMe(adminId);
    if (!adminId) { setLoading(false); return; }
    const { data } = await rpc("admin_list_admins", { p_admin_id: adminId });
    setAdmins((data as AdminRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const adminIds = new Set(admins.map((a) => a.user_id));
  const candidates = users
    .filter((u) => !adminIds.has(u.user_id))
    .filter((u) => search.trim()
      ? [u.display_name, u.username, u.user_id].some((f) => f?.toLowerCase().includes(search.toLowerCase().trim()))
      : false)
    .slice(0, 8);

  const addAdmin = async (target: string) => {
    if (!me) return;
    setBusy(true);
    const { error } = await rpc("admin_add_admin", { p_admin_id: me, p_target: target, p_role: newRole });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added as ${ROLE_LABELS[newRole]}`);
    setAdding(false); setSearch("");
    void load();
  };

  const removeAdmin = async (target: string) => {
    if (!me) return;
    if (!window.confirm("Remove this super admin?")) return;
    setBusy(true);
    const { error } = await rpc("admin_remove_admin", { p_admin_id: me, p_target: target });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Admin removed");
    void load();
  };

  const changeRole = async (target: string, role: AdminRoleKey) => {
    if (!me) return;
    setBusy(true);
    const { error } = await rpc("admin_add_admin", { p_admin_id: me, p_target: target, p_role: role });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Role updated to ${ROLE_LABELS[role]}`);
    void load();
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={navItemLabel(id)}
        subtitle={`${admins.length} super admin${admins.length === 1 ? "" : "s"}`}
        action={<Button onClick={() => setAdding(true)}><ShieldPlus className="mr-2 h-4 w-4" /> Add Admin</Button>}
      />
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Admin Since</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && admins.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No admins.</TableCell></TableRow>}
              {admins.map((a) => (
                <TableRow key={a.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar url={a.avatar_url} name={a.display_name || a.username} size="sm" />
                      <div><p className="font-medium">{a.display_name || "Unnamed"}{a.user_id === me && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p><p className="text-xs text-muted-foreground">@{a.username || "—"}</p></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.user_id === me ? (
                      <Badge variant={a.role === "super_admin" ? "default" : "secondary"}>{ROLE_LABELS[a.role] ?? a.role}</Badge>
                    ) : (
                      <Select value={a.role} onValueChange={(v) => changeRole(a.user_id, v as AdminRoleKey)} disabled={busy}>
                        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{a.phone_number || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(a.admin_since).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy || a.user_id === me} onClick={() => removeAdmin(a.user_id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={adding} onOpenChange={(o) => { if (!o) { setAdding(false); setSearch(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Super Admin</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium">Role</p>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AdminRoleKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">Moderator — users, chats & moderation</SelectItem>
                  <SelectItem value="support">Support — customer support inbox</SelectItem>
                  <SelectItem value="employee">Employee — own referral pipeline only</SelectItem>
                  <SelectItem value="super_admin">Super Admin — full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus placeholder="Search users by name or @username…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {search.trim() && candidates.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching users.</p>}
              {candidates.map((u) => (
                <button key={u.user_id} disabled={busy} onClick={() => addAdmin(u.user_id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left hover:bg-muted disabled:opacity-50">
                  <span className="flex items-center gap-2">
                    <UserAvatar url={u.avatar_url} name={u.display_name || u.username} size="sm" />
                    <span><span className="block font-medium">{u.display_name || "Unnamed"}</span><span className="block text-xs text-muted-foreground">@{u.username || "—"}</span></span>
                  </span>
                  <ShieldPlus className="h-4 w-4 text-primary" />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setAdding(false); setSearch(""); }}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}