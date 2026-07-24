import { Card } from "@/components/ui/card";
import { PlatformStats } from "../useAdminData";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import { cn } from "@/lib/utils";
import { Users, Wifi, MessageSquare, MessagesSquare, ShieldAlert, Crown, BadgeCheck, Banknote } from "lucide-react";

export default function SystemHealthSection({ id, stats, loading }: { id: string; stats: PlatformStats; loading: boolean }) {
  const services = [
    { name: "Database", ok: true, detail: "Operational" },
    { name: "Realtime / Chat", ok: stats.total_messages > 0, detail: "Operational" },
    { name: "Authentication", ok: stats.total_users > 0, detail: "Operational" },
    { name: "Payments", ok: stats.pending_withdrawals >= 0, detail: stats.pending_withdrawals > 0 ? `${stats.pending_withdrawals} withdrawals pending` : "Operational" },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Live platform health & key totals" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((s) => (
          <Card key={s.name} className="flex items-center gap-3 p-4 shadow-card">
            <span className={cn("flex h-3 w-3 shrink-0 rounded-full", s.ok ? "bg-admin-success" : "bg-admin-warning")} />
            <div className="min-w-0">
              <p className="font-medium">{s.name}</p>
              <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Users" value={loading ? "—" : stats.total_users.toLocaleString()} icon={Users} />
        <StatTile label="Online Now" value={loading ? "—" : stats.online_users.toLocaleString()} icon={Wifi} />
        <StatTile label="Total Messages" value={loading ? "—" : stats.total_messages.toLocaleString()} icon={MessageSquare} />
        <StatTile label="Total Rooms" value={loading ? "—" : stats.total_rooms.toLocaleString()} icon={MessagesSquare} />
        <StatTile label="Verified Users" value={loading ? "—" : stats.verified_users.toLocaleString()} icon={BadgeCheck} />
        <StatTile label="Premium Users" value={loading ? "—" : stats.premium_users.toLocaleString()} icon={Crown} />
        <StatTile label="Pending Reports" value={loading ? "—" : stats.pending_reports.toLocaleString()} icon={ShieldAlert} />
        <StatTile label="Active Subscribers" value={loading ? "—" : stats.active_subs.toLocaleString()} icon={Banknote} />
      </div>
    </div>
  );
}
