import { apiClient } from "@/lib/apiClient";

export interface ContestItem {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_winners: number | null;
  created_at: string;
  criteria?: string;
  criteria_label?: string | null;
  participant_count: number;
  joined: boolean;
  rewarded: boolean;
}

export interface ContestLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string;
  joined_at: string | null;
  online_minutes_since_join: number;
  score?: number;
  criteria?: string;
  rewarded: boolean;
  rewarded_at: string | null;
}

export async function listContests(status?: string): Promise<ContestItem[]> {
  const { data } = await apiClient.get("/contests", { params: status ? { status } : {} });
  return data;
}

export async function getContestLeaderboard(contestId: string): Promise<ContestLeaderboardEntry[]> {
  const { data } = await apiClient.get(`/contests/${contestId}/leaderboard`);
  return data;
}

/** Joins a contest. `already_joined` is true when you were in it already. */
export async function joinContest(contestId: string): Promise<{ joined: boolean; already_joined?: boolean }> {
  const { data } = await apiClient.post(`/contests/${contestId}/join`);
  return data;
}
