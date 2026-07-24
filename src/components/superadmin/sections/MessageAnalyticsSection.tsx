import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformStats } from "../useAdminData";
import { useAnalyticsData } from "../useAnalyticsData";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import { MessageSquare, MessagesSquare, Image, Mic, Video } from "lucide-react";

const fmtDay = (d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });

export default function MessageAnalyticsSection({ id, stats }: { id: string; stats: PlatformStats }) {
  const { loading, daily, types } = useAnalyticsData(14);
  const chart = useMemo(() => daily.map((d) => ({ ...d, label: fmtDay(d.day) })), [daily]);
  const total = types.reduce((s, t) => s + t.count, 0);
  const byType = (t: string) => types.find((x) => x.type === t)?.count || 0;

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Live message statistics across all chats" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Messages" value={stats.total_messages.toLocaleString()} icon={MessageSquare} />
        <StatTile label="Sent Today" value={stats.messages_today.toLocaleString()} icon={MessagesSquare} />
        <StatTile label="Images" value={byType("image").toLocaleString()} icon={Image} />
        <StatTile label="Voice Notes" value={byType("audio").toLocaleString()} icon={Mic} />
      </div>

      <Card className="p-4 shadow-card">
        <p className="mb-3 font-semibold">Messages per Day (14d)</p>
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

      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message Type</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && types.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No messages yet.</TableCell></TableRow>}
              {types.map((t) => (
                <TableRow key={t.type}>
                  <TableCell className="font-medium capitalize">{t.type.replace("_", " ")}</TableCell>
                  <TableCell className="tabular-nums">{t.count.toLocaleString()}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{total ? ((t.count / total) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
