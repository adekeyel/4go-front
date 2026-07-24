import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AdminSub } from "../useAdminData";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import { Banknote, Users, Repeat, TrendingUp } from "lucide-react";

export default function RevenueSection({ id, subscriptions, totalUsers }: { id: string; subscriptions: AdminSub[]; totalUsers: number }) {
  const active = subscriptions.filter((s) => s.status === "active");
  const totalRevenue = subscriptions.reduce((sum, s) => sum + (s.amount_ngn || 0), 0);
  const mrr = active.reduce((sum, s) => sum + (s.amount_ngn || 0), 0);
  const arpu = totalUsers > 0 ? Math.round(totalRevenue / totalUsers) : 0;

  const monthly = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets[d.toLocaleString("en", { month: "short" })] = 0;
    }
    subscriptions.forEach((s) => {
      const d = new Date(s.created_at);
      const key = d.toLocaleString("en", { month: "short" });
      if (key in buckets) buckets[key] += s.amount_ngn || 0;
    });
    return Object.entries(buckets).map(([month, revenue]) => ({ month, revenue }));
  }, [subscriptions]);

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Subscription & premium earnings" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Revenue" value={`₦${totalRevenue.toLocaleString()}`} icon={Banknote} />
        <StatTile label="Active Subscribers" value={active.length} icon={Users} />
        <StatTile label="MRR" value={`₦${mrr.toLocaleString()}`} icon={Repeat} />
        <StatTile label="ARPU" value={`₦${arpu.toLocaleString()}`} icon={TrendingUp} />
      </div>

      <Card className="p-4 shadow-card">
        <p className="mb-3 font-semibold">Monthly Revenue</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Renews</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.slice(0, 100).length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No subscriptions yet.</TableCell></TableRow>
              )}
              {subscriptions.slice(0, 100).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="capitalize font-medium">{s.plan}</TableCell>
                  <TableCell>₦{(s.amount_ngn || 0).toLocaleString()}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status}</Badge>
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