import { useEffect, useState } from "react";
import * as walletApi from "@/api/wallet";
import * as profilesApi from "@/api/profiles";
import { useAuth } from "@/contexts/AuthContext";

export type VerificationApp = {
  id: string;
  status: "pending" | "approved" | "rejected";
  is_verified: boolean;
  applied_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
};

export type VerificationState = {
  loading: boolean;
  isVerified: boolean;
  latest: VerificationApp | null;
  refresh: () => Promise<void>;
};

export function useVerification(userId?: string): VerificationState {
  const { user } = useAuth();
  const uid = userId ?? user?.id;
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<VerificationApp | null>(null);

  const load = async () => {
    if (!uid) {
      setLoading(false);
      setLatest(null);
      return;
    }
    setLoading(true);
    if (userId && userId !== user?.id) {
      // Someone else's badge: only the public is_verified flag is visible.
      const other = await profilesApi.getProfile(userId).catch(() => null);
      setLatest(other?.is_verified ? ({ id: "", status: "approved", is_verified: true } as unknown as VerificationApp) : null);
      setLoading(false);
      return;
    }
    const data = await walletApi.getLatestVerification().catch(() => null);
    setLatest((data as VerificationApp | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return {
    loading,
    isVerified: !!latest && latest.status === "approved" && latest.is_verified,
    latest,
    refresh: load,
  };
}