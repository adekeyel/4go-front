import { Users, UserCheck, Wifi, MessageSquare, UserPlus, Flag, Ban, Banknote, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Kpis } from "./useAdminData";
import { cn } from "@/lib/utils";

interface CardDef {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "info" | "success" | "warning" | "danger";
  money?: boolean;
}

const toneClasses: Record<CardDef["tone"], string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-admin-success/10 text-admin-success",
  warning: "bg-admin-warning/10 text-admin-warning",
  danger: "bg-admin-danger/10 text-admin-danger",
};

export default function AdminKpis({ kpis, loading }: { kpis: Kpis; loading: boolean }) {
  const cards: CardDef[] = [
    { label: "Total Users", value: kpis.totalUsers, icon: Users, tone: "info" },
    { label: "Active Today", value: kpis.activeToday, icon: UserCheck, tone: "success" },
    { label: "Online Now", value: kpis.onlineUsers, icon: Wifi, tone: "success" },
    { label: "Messages Today", value: kpis.messagesToday, icon: MessageSquare, tone: "info" },
    { label: "New Registrations", value: kpis.newToday, icon: UserPlus, tone: "info" },
    { label: "Reported / Pending", value: kpis.reportedMessages, icon: Flag, tone: "warning" },
    { label: "Banned Users", value: kpis.bannedUsers, icon: Ban, tone: "danger" },
    { label: "Revenue (₦)", value: kpis.revenue, icon: Banknote, tone: "success", money: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="flex items-center gap-3 p-4 shadow-card">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneClasses[c.tone])}>
            <c.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold tabular-nums">
              {loading ? "—" : c.money ? `₦${c.value.toLocaleString()}` : c.value.toLocaleString()}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}