import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AdminKpis from "../AdminKpis";
import { AdminReport, AdminSub, AdminUser, Kpis } from "../useAdminData";
import { SectionHeader } from "./primitives";
import LiveActivitySection from "./LiveActivitySection";

export default function OverviewSection({
  kpis, loading, users, reports, subscriptions,
}: { kpis: Kpis; loading: boolean; users: AdminUser[]; reports: AdminReport[]; subscriptions: AdminSub[] }) {
  const growth = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0);
      days[d.toLocaleDateString("en", { weekday: "short" })] = 0;
    }
    users.forEach((u) => {
      const d = new Date(u.created_at);
      const diff = (Date.now() - d.getTime()) / 86400000;
      if (diff <= 7) {
        const key = d.toLocaleDateString("en", { weekday: "short" });
        if (key in days) days[key] += 1;
      }
    });
    return Object.entries(days).map(([day, count]) => ({ day, count }));
  }, [users]);

  return (
    <div className="space-y-5">
      <SectionHeader title="Dashboard Overview" subtitle="Real-time platform health at a glance" />
      <AdminKpis kpis={kpis} loading={loading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 shadow-card">
          <p className="mb-3 font-semibold">New Registrations (7 days)</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={growth}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <div className="max-h-[320px] overflow-y-auto">
          <LiveActivitySection id="live-activity" users={users} reports={reports} subscriptions={subscriptions} />
        </div>
      </div>
    </div>
  );
}