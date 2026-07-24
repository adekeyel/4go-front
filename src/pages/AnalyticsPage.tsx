import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Eye, Coins, TrendingUp, BarChart3, Calendar } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface DailyStat {
  date: string;
  views: number;
  earnings: number;
}

export default function AnalyticsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user, period]);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);

    const since = subDays(new Date(), period).toISOString();

    // Fetch earning transactions for this user
    const { data: earnings } = await supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .eq("source", "earning")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const txData = earnings || [];

    // Build daily map
    const dayMap: Record<string, { views: number; earnings: number }> = {};
    for (let i = 0; i < period; i++) {
      const d = format(subDays(new Date(), period - 1 - i), "yyyy-MM-dd");
      dayMap[d] = { views: 0, earnings: 0 };
    }

    let tViews = 0;
    let tEarnings = 0;
    txData.forEach((tx) => {
      const d = format(new Date(tx.created_at), "yyyy-MM-dd");
      if (dayMap[d]) {
        dayMap[d].views += 1;
        dayMap[d].earnings += tx.amount;
      }
      tViews += 1;
      tEarnings += tx.amount;
    });

    setTotalViews(tViews);
    setTotalEarnings(tEarnings);
    setDailyStats(
      Object.entries(dayMap).map(([date, s]) => ({
        date: format(new Date(date), "MMM d"),
        views: s.views,
        earnings: s.earnings,
      }))
    );
    setLoading(false);
  };

  const isMonetized = profile?.is_monetized ?? false;

  if (!isMonetized) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-10">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-display font-bold text-foreground">View Analytics</h1>
          </div>
          <div className="text-center py-16">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Analytics is available for monetized users only.</p>
            <p className="text-xs text-muted-foreground mt-1">Reach Master rank to unlock monetization.</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-primary/80 px-4 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-bold text-primary-foreground">View Analytics</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Total Views</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {loading ? "..." : totalViews.toLocaleString()}
          </p>
        </div>
        <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">Earnings</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {loading ? "..." : (
              <>
                {totalEarnings.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">coins</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">≈ ₦{(totalEarnings / 2).toLocaleString()}</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex px-4 mt-4 gap-1 bg-muted rounded-xl mx-4 p-1">
        {([7, 14, 30] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Daily Views
        </h3>
        {loading ? (
          <div className="h-48 bg-card rounded-xl animate-pulse" />
        ) : (
          <div className="bg-card rounded-xl p-3 border border-border">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={period <= 7 ? 0 : "preserveStartEnd"}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "views" ? `${value} views` : `${value} coins`,
                    name === "views" ? "Views" : "Earnings",
                  ]}
                />
                <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Earnings Chart */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-500" />
          Daily Earnings
        </h3>
        {loading ? (
          <div className="h-48 bg-card rounded-xl animate-pulse" />
        ) : (
          <div className="bg-card rounded-xl p-3 border border-border">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={period <= 7 ? 0 : "preserveStartEnd"}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [`₦${(value / 2).toFixed(1)}`, "Earnings"]}
                />
                <Bar dataKey="earnings" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Rate Info */}
      <div className="px-4 mt-4">
        <div className="bg-card rounded-xl p-3 border border-border">
          <p className="text-xs text-muted-foreground text-center">
            You earn <span className="font-bold text-foreground">1 coin (₦0.10)</span> per unique view on room photos, videos, and long posts. DM messages are excluded.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
