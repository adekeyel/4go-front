import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/UserAvatar";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import {
  Smartphone, Wifi, ShieldAlert, Banknote, AlertTriangle, UserX, MonitorSmartphone, Globe,
} from "lucide-react";

type Variant = "login" | "suspicious" | "devices" | "ip" | "fraud";

interface Overview {
  total_devices: number;
  multi_device_users: number;
  active_sessions_24h: number;
  suspended_accounts: number;
  flagged_accounts: number;
  pending_withdrawals: number;
  large_withdrawals: number;
}

interface FlaggedAccount {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_suspended: boolean | null;
  report_count: number;
  last_reported: string;
}

interface Device {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  endpoint: string;
  created_at: string;
  updated_at: string | null;
  is_online: boolean | null;
}

const EMPTY: Overview = {
  total_devices: 0, multi_device_users: 0, active_sessions_24h: 0, suspended_accounts: 0,
  flagged_accounts: 0, pending_withdrawals: 0, large_withdrawals: 0,
};

function deviceLabel(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname;
    if (host.includes("apple")) return "Apple (Safari/iOS)";
    if (host.includes("mozilla")) return "Firefox";
    if (host.includes("google") || host.includes("fcm")) return "Chrome / Android";
    if (host.includes("windows") || host.includes("microsoft")) return "Edge / Windows";
    return host;
  } catch { return "Unknown device"; }
}

export default function SecuritySection({ id, variant }: { id: string; variant: Variant }) {
  const [overview, setOverview] = useState<Overview>(EMPTY);
  const [flagged, setFlagged] = useState<FlaggedAccount[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id;
    if (!adminId) { setLoading(false); return; }
    const rpc = (n: string, a: object) =>
      (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown }>).call(supabase, n, a);
    const [ov, fl, dv] = await Promise.all([
      rpc("admin_security_overview", { p_admin_id: adminId }),
      rpc("admin_flagged_accounts", { p_admin_id: adminId }),
      rpc("admin_devices", { p_admin_id: adminId }),
    ]);
    setOverview((ov.data as Overview) || EMPTY);
    setFlagged(((fl.data as FlaggedAccount[]) || []).map((f) => ({ ...f, report_count: Number(f.report_count) })));
    setDevices((dv.data as Device[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const suspend = async (u: FlaggedAccount) => {
    const next = !u.is_suspended;
    const reason = next ? window.prompt("Reason for freezing this account?", "Security risk") : null;
    if (next && reason === null) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update(
      (next ? { is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason }
            : { is_suspended: false, suspended_at: null, suspended_reason: null }) as never,
    ).eq("user_id", u.user_id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Account frozen" : "Account unfrozen");
    void load();
  };

  const revokeDevice = async (d: Device) => {
    if (!window.confirm("Force logout this device (remove its push session)?")) return;
    setBusy(true);
    const { error } = await supabase.from("push_subscriptions").delete().eq("id", d.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Device session revoked");
    void load();
  };

  const ipGroups = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach((d) => { const l = deviceLabel(d.endpoint); map.set(l, (map.get(l) || 0) + 1); });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [devices]);

  const metrics = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Active Sessions (24h)" value={loading ? "—" : overview.active_sessions_24h.toLocaleString()} icon={Wifi} />
      <StatTile label="Registered Devices" value={loading ? "—" : overview.total_devices.toLocaleString()} icon={Smartphone} />
      <StatTile label="Multi-device Users" value={loading ? "—" : overview.multi_device_users.toLocaleString()} icon={MonitorSmartphone} />
      <StatTile label="Flagged Accounts" value={loading ? "—" : overview.flagged_accounts.toLocaleString()} icon={ShieldAlert} />
      <StatTile label="Suspended Accounts" value={loading ? "—" : overview.suspended_accounts.toLocaleString()} icon={UserX} />
      <StatTile label="Pending Withdrawals" value={loading ? "—" : overview.pending_withdrawals.toLocaleString()} icon={Banknote} />
      <StatTile label="High-value Withdrawals" value={loading ? "—" : overview.large_withdrawals.toLocaleString()} icon={AlertTriangle} />
    </div>
  );

  const flaggedTable = (
    <Card className="overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead className="hidden md:table-cell">Last Reported</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && flagged.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No flagged accounts.</TableCell></TableRow>}
            {flagged.map((u) => (
              <TableRow key={u.user_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar url={u.avatar_url} name={u.display_name || u.username} size="sm" />
                    <div><p className="font-medium">{u.display_name || "Unnamed"}</p><p className="text-xs text-muted-foreground">@{u.username || "—"}</p></div>
                  </div>
                </TableCell>
                <TableCell><Badge variant={u.report_count >= 3 ? "destructive" : "secondary"}>{u.report_count}</Badge></TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(u.last_reported).toLocaleDateString()}</TableCell>
                <TableCell>{u.is_suspended ? <Badge variant="destructive">Frozen</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={u.is_suspended ? "outline" : "destructive"} disabled={busy} onClick={() => suspend(u)}>
                    {u.is_suspended ? "Unfreeze" : "Freeze"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  const devicesTable = (
    <Card className="overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Device</TableHead>
              <TableHead className="hidden lg:table-cell">Last Active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && devices.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No registered devices.</TableCell></TableRow>}
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar url={d.avatar_url} name={d.display_name || d.username} size="sm" online={!!d.is_online} showOnline />
                    <div><p className="font-medium">{d.display_name || "Unnamed"}</p><p className="text-xs text-muted-foreground">@{d.username || "—"}</p></div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{deviceLabel(d.endpoint)}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(d.updated_at || d.created_at).toLocaleString()}</TableCell>
                <TableCell>{d.is_online ? <Badge className="bg-admin-success text-white hover:bg-admin-success">Online</Badge> : <Badge variant="secondary">Offline</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => revokeDevice(d)}>Force Logout</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  const ipTable = (
    <Card className="overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform / Gateway</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && ipGroups.length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No session data.</TableCell></TableRow>}
            {ipGroups.map((g) => (
              <TableRow key={g.label}>
                <TableCell className="flex items-center gap-2 font-medium"><Globe className="h-4 w-4 text-muted-foreground" /> {g.label}</TableCell>
                <TableCell className="tabular-nums">{g.count}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{devices.length ? ((g.count / devices.length) * 100).toFixed(0) : 0}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  let body: JSX.Element;
  let subtitle = "";
  switch (variant) {
    case "login": body = <>{metrics}{devicesTable}</>; subtitle = "Active sessions & recent login devices"; break;
    case "devices": body = devicesTable; subtitle = "Registered push devices across the platform"; break;
    case "suspicious": body = flaggedTable; subtitle = "Accounts flagged by user reports"; break;
    case "fraud": body = <>{metrics}{flaggedTable}</>; subtitle = "Withdrawal risk & repeat-offender detection"; break;
    case "ip": body = ipTable; subtitle = "Sessions grouped by platform / push gateway"; break;
    default: body = metrics;
  }

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={subtitle} />
      {body}
    </div>
  );
}