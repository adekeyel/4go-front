import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PremiumState = {
  loading: boolean;
  isPremium: boolean;
  plan: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  refresh: () => Promise<void>;
};

/** Reads the user's active subscription, if any. */
export function usePremium(userId?: string): PremiumState {
  const { user } = useAuth();
  const uid = userId ?? user?.id;
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "yearly" | null>(null);
  const [currentPeriodEnd, setEnd] = useState<string | null>(null);

  const load = async () => {
    if (!uid) {
      setLoading(false);
      setIsPremium(false);
      setPlan(null);
      setEnd(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", uid)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    const active =
      !!data && new Date(data.current_period_end as string).getTime() > Date.now();
    setIsPremium(active);
    setPlan(active ? ((data!.plan as "monthly" | "yearly") ?? null) : null);
    setEnd(active ? ((data!.current_period_end as string) ?? null) : null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return { loading, isPremium, plan, currentPeriodEnd, refresh: load };
}