import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AdminUser } from "../useAdminData";
import { useAnalyticsData } from "../useAnalyticsData";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import { TrendingUp, Users, MessageSquare, Activity, Repeat } from "lucide-react";

type Variant = "growth" | "chat" | "engagement" | "retention";

const fmtDay = (d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });

export default function AnalyticsSection({ id, variant, users }: { id: string; variant: Variant; users: AdminUser[] }) {
  const { loading, daily, types } = useAnalyticsData(14);

  const chart = useMemo(() => daily.map((d) => ({ ...d, label: fmtDay(d.day) })), [daily]);

  const totals = useMemo(() => {
    const newUsers = daily.reduce((s, d) => s + d.new_users, 0);
    const msgs = daily.reduce((s, d) => s + d.messages, 0);
    const avgActive = daily.length ? Math.round(daily.reduce((s, d) => s + d.active_users, 0) / daily.length) : 0;
    const online = users.filter((u) => u.is_online).length;
    return { newUsers, msgs, avgActive, online };
  }, [daily, users]);

  const typeChart = useMemo(() => types.map((t) => ({ name: t.type.replace("_", " "), value: t.count })), [types]);

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Last 14 days · live platform data" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="New Users (14d)" value={loading ? "—" : totals.newUsers} icon={Users} />
        <StatTile label="Messages (14d)" value={loading ? "—" : totals.msgs.toLocaleString()} icon={MessageSquare} />
        <StatTile label="Avg Daily Active" value={loading ? "—" : totals.avgActive} icon={Activity} />
        <StatTile label="Online Now" value={loading ? "—" : totals.online} icon={Repeat} />
      </div>

      {variant === "growth" && (
        <Card className="p-4 shadow-card">
          <p className="mb-3 font-semibold">New User Registrations</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="agrow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="new_users" name="New users" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#agrow)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {variant === "chat" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 shadow-card">
            <p className="mb-3 font-semibold">Messages per Day</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="messages" name="Messages" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4 shadow-card">
            <p className="mb-3 font-semibold">Messages by Type (all time)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" name="Count" fill="hsl(var(--admin-success))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {(variant === "engagement" || variant === "retention") && (
        <Card className="p-4 shadow-card">
          <p className="mb-3 font-semibold">{variant === "retention" ? "Daily Active Users" : "Active Users vs Messages"}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="active_users" name="Active users" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              {variant === "engagement" && (
                <Line type="monotone" dataKey="messages" name="Messages" stroke="hsl(var(--admin-warning))" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
