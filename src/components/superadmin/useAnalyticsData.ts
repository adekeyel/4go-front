import { useCallback, useEffect, useState } from "react";
import * as adminApi from "@/api/admin";

export interface DailyMetric {
  day: string;
  new_users: number;
  messages: number;
  active_users: number;
  new_subs: number;
}

export interface TypeBreakdown {
  type: string;
  count: number;
}

export function useAnalyticsData(days = 14) {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [types, setTypes] = useState<TypeBreakdown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [dailyRows, typeRows] = await Promise.all([
      adminApi.getDailyMetrics<DailyMetric>(days).catch(() => [] as DailyMetric[]),
      adminApi.getMessageTypeBreakdown<TypeBreakdown>().catch(() => [] as TypeBreakdown[]),
    ]);

    setDaily(dailyRows.map((d) => ({
      ...d,
      new_users: Number(d.new_users),
      messages: Number(d.messages),
      active_users: Number(d.active_users),
      new_subs: Number(d.new_subs),
    })));
    setTypes(typeRows.map((t) => ({ type: t.type, count: Number(t.count) })));
    setLoading(false);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  return { loading, daily, types, refresh: load };
}
