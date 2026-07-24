import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    const { data } = await supabase
      .from("verification_applications")
      .select("id, status, is_verified, applied_at, reviewed_at, review_notes")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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