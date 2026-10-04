import { apiClient } from "@/lib/apiClient";

export interface ReferralOverview {
  code: string;
  bonus_per_referral: number;
  total: number;
  referrals: {
    id: string;
    created_at: string;
    coins_rewarded: number;
    referred: { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  }[];
}

export async function getMyReferrals(): Promise<ReferralOverview> {
  const { data } = await apiClient.get("/referrals/me");
  return data;
}
