import { useEffect, useState } from "react";
import * as walletApi from "@/api/wallet";
import * as profilesApi from "@/api/profiles";
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
    if (userId && userId !== user?.id) {
      // Someone else's status: only the public is_premium flag is visible.
      const other = await profilesApi.getProfile(userId).catch(() => null);
      setIsPremium(!!other?.is_premium);
      setPlan(null);
      setEnd(null);
      setLoading(false);
      return;
    }
    const data = await walletApi.getSubscription().catch(() => null);
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