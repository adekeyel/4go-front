import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type FriendRequest = Tables<"friends"> & { profile: Profile };

export async function listFriends(): Promise<Profile[]> {
  const { data } = await apiClient.get("/friends");
  return data;
}

export async function listFriendRequests(): Promise<FriendRequest[]> {
  const { data } = await apiClient.get("/friends/requests");
  return data;
}

export async function sendFriendRequest(addresseeId: string) {
  const { data } = await apiClient.post("/friends/requests", { addresseeId });
  return data;
}

export async function respondToFriendRequest(requestId: string, status: "accepted" | "declined") {
  const { data } = await apiClient.patch(`/friends/requests/${requestId}`, { status });
  return data;
}

export async function removeFriend(otherUserId: string) {
  await apiClient.delete(`/friends/${otherUserId}`);
}

export async function blockUser(blockedId: string, reason?: string) {
  await apiClient.post("/friends/block", { blockedId, reason });
}

export async function unblockUser(blockedId: string) {
  await apiClient.delete(`/friends/block/${blockedId}`);
}

export interface SuggestedFriend {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  shared_rooms: number;
  mutual_friends: number;
}

export async function getSuggestions(limit = 20): Promise<SuggestedFriend[]> {
  const { data } = await apiClient.get("/friends/suggestions", { params: { limit } });
  return data;
}
