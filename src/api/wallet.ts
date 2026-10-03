import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/integrations/supabase/types";

export async function listTransactions(): Promise<Tables<"transactions">[]> {
  const { data } = await apiClient.get("/wallet/transactions");
  return data;
}

export async function listWithdrawals(): Promise<Tables<"withdrawals">[]> {
  const { data } = await apiClient.get("/wallet/withdrawals");
  return data;
}

export async function getSubscription(): Promise<{ plan: string; status: string; current_period_end: string } | null> {
  const { data } = await apiClient.get("/wallet/subscription");
  return data;
}

export async function getLatestVerification() {
  const { data } = await apiClient.get("/wallet/verification");
  return data;
}

export async function initiatePayment(input: {
  amount: number;
  purpose: "coins" | "premium" | "verification";
  plan?: "monthly" | "yearly";
  coinAmount?: number;
  redirectUrl?: string;
}): Promise<{ link: string; txRef: string }> {
  const { data } = await apiClient.post("/payments/initiate", input);
  return data;
}

export async function verifyPayment(transactionId: string) {
  const { data } = await apiClient.post("/payments/verify", { transactionId });
  return data;
}
