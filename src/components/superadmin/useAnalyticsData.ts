import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id;
    if (!adminId) { setLoading(false); return; }

    const [dailyRes, typesRes] = await Promise.all([
      supabase.rpc("admin_daily_metrics", { p_admin_id: adminId, p_days: days }),
      supabase.rpc("admin_message_type_breakdown", { p_admin_id: adminId }),
    ]);

    setDaily(((dailyRes?.data as DailyMetric[]) || []).map((d) => ({
      ...d,
      new_users: Number(d.new_users),
      messages: Number(d.messages),
      active_users: Number(d.active_users),
      new_subs: Number(d.new_subs),
    })));
    setTypes(((typesRes?.data as TypeBreakdown[]) || []).map((t) => ({ type: t.type, count: Number(t.count) })));
    setLoading(false);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  return { loading, daily, types, refresh: load };
}
