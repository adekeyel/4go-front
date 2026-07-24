import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { UserPlus, Flag, Banknote, ShieldCheck, type LucideIcon } from "lucide-react";
import { AdminReport, AdminSub, AdminUser } from "../useAdminData";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";
import { cn } from "@/lib/utils";

interface Event { ts: number; icon: LucideIcon; tone: string; text: string; }

export default function LiveActivitySection({ id, users, reports, subscriptions }: { id: string; users: AdminUser[]; reports: AdminReport[]; subscriptions: AdminSub[] }) {
  const events = useMemo(() => {
    const list: Event[] = [];
    users.slice(0, 40).forEach((u) => list.push({
      ts: new Date(u.created_at).getTime(), icon: UserPlus, tone: "bg-primary/10 text-primary",
      text: `New registration: ${u.display_name || u.username || "user"}`,
    }));
    reports.slice(0, 40).forEach((r) => list.push({
      ts: new Date(r.created_at).getTime(), icon: Flag, tone: "bg-admin-warning/10 text-admin-warning",
      text: `Report submitted: ${r.reason}`,
    }));
    subscriptions.slice(0, 40).forEach((s) => list.push({
      ts: new Date(s.created_at).getTime(), icon: Banknote, tone: "bg-admin-success/10 text-admin-success",
      text: `Payment received: ${s.plan} (₦${(s.amount_ngn || 0).toLocaleString()})`,
    }));
    users.filter((u) => u.is_verified).slice(0, 15).forEach((u) => list.push({
      ts: new Date(u.created_at).getTime(), icon: ShieldCheck, tone: "bg-primary/10 text-primary",
      text: `Verified account: ${u.display_name || u.username}`,
    }));
    return list.sort((a, b) => b.ts - a.ts).slice(0, 60);
  }, [users, reports, subscriptions]);

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Recent platform events" />
      <Card className="divide-y shadow-card">
        {events.length === 0 && <p className="p-8 text-center text-muted-foreground">No recent activity.</p>}
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", e.tone)}>
              <e.icon className="h-4 w-4" />
            </div>
            <p className="flex-1 truncate text-sm">{e.text}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.ts).toLocaleString()}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}