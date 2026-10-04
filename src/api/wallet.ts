import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/types/database";

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
  /** Only used for coins (₦1 = 1 coin). Premium and verification are priced by the server. */
  amount?: number;
  purpose: "coins" | "premium" | "verification";
  plan?: "monthly" | "yearly";
  redirectUrl?: string;
}): Promise<{ link: string; txRef: string }> {
  const { data } = await apiClient.post("/payments/initiate", input);
  return data;
}

export async function verifyPayment(transactionId: string) {
  const { data } = await apiClient.post("/payments/verify", { transactionId });
  return data;
}

// --- Treasures, gifts, level-up ---

export interface Treasure {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string | null;
  sort_order: number;
}

export async function listTreasures(): Promise<Treasure[]> {
  const { data } = await apiClient.get("/wallet/treasures");
  return data;
}

export async function sendGift(input: { receiverId: string; treasureId: string; roomId?: string | null }) {
  const { data } = await apiClient.post("/wallet/gifts", {
    receiver_id: input.receiverId,
    treasure_id: input.treasureId,
    room_id: input.roomId ?? null,
  });
  return data;
}

export async function sendPostGift(input: { receiverId: string; treasureId: string; messageId: string; roomId?: string | null }) {
  const { data } = await apiClient.post("/wallet/gifts/post", {
    receiver_id: input.receiverId,
    treasure_id: input.treasureId,
    message_id: input.messageId,
    room_id: input.roomId ?? null,
  });
  return data;
}

/** Spend coins (multiples of 5,000) for online minutes. */
export async function levelUp(amount: number): Promise<{ minutes_added: number; new_rank: string }> {
  const { data } = await apiClient.post("/wallet/level-up", { amount });
  return data;
}

// --- Withdrawals ---

export async function resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ success: boolean; account_name?: string; error?: string }> {
  try {
    const { data } = await apiClient.post("/payouts/resolve-account", { account_number: accountNumber, account_bank: bankCode });
    return data;
  } catch (err: any) {
    // 400 and 429 carry a readable error; anything else is a connection problem.
    return { success: false, error: err?.response?.data?.error };
  }
}

export async function requestWithdrawal(input: { amount: number; bank_code: string; account_number: string; account_name: string }) {
  const { data } = await apiClient.post("/wallet/withdrawals", input);
  return data;
}

// --- Daily claim ---

export interface DailyClaimStatus {
  canClaim: boolean;
  claimsToday: number;
  maxPerDay: number;
  nextClaimAt: string | null;
}

export async function getDailyClaimStatus(): Promise<DailyClaimStatus> {
  const { data } = await apiClient.get("/wallet/daily-claim/status");
  return data;
}

export async function claimDaily(): Promise<{ coinsAwarded: number; claimId: string }> {
  const { data } = await apiClient.post("/wallet/daily-claim");
  return data;
}

/** The two "visit our sponsor" boosts after a claim (+100 coins each, decided by the server). */
export async function boostDailyClaim(stage: 1 | 2): Promise<{ alreadyGranted: boolean; coinsAwarded: number }> {
  const { data } = await apiClient.post("/wallet/daily-claim/boost", { stage });
  return data;
}

export async function listEarnings(sinceIso: string): Promise<{ amount: number; created_at: string }[]> {
  const { data } = await apiClient.get("/wallet/transactions", { params: { source: "earning", since: sinceIso, limit: 2000 } });
  return data;
}

export async function getWallet(): Promise<{ coins: number; purchased_coins: number; earned_coins: number; reward_coins: number; is_premium: boolean; rank: string }> {
  const { data } = await apiClient.get("/wallet");
  return data;
}
