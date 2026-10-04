import { apiClient } from "@/lib/apiClient";

export interface StatusProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rank?: string | null;
  is_verified?: boolean | null;
}

export interface StatusItem {
  id: string;
  user_id: string;
  type: "photo" | "video" | "text";
  media_url: string | null;
  caption: string | null;
  bg_color: string | null;
  text_content: string | null;
  created_at: string;
  expires_at: string;
  profile?: StatusProfile;
  has_viewed: boolean;
  my_reaction: string | null;
  /** Only on your own statuses. */
  view_count?: number;
  reaction_count?: number;
}

/** Yours and your friends' unexpired statuses, newest first. */
export async function listStatuses(): Promise<StatusItem[]> {
  const { data } = await apiClient.get("/statuses");
  return data;
}

export async function createStatus(input: {
  type: "text" | "photo" | "video";
  media_url?: string | null;
  caption?: string | null;
  bg_color?: string | null;
  text_content?: string | null;
}) {
  const { data } = await apiClient.post("/statuses", input);
  return data;
}

export async function deleteStatus(statusId: string) {
  await apiClient.delete(`/statuses/${statusId}`);
}

/** Your own views and repeats are ignored by the server. */
export async function recordStatusView(statusId: string) {
  const { data } = await apiClient.post(`/statuses/${statusId}/view`);
  return data;
}

export interface StatusViewer {
  viewer: StatusProfile;
  viewed_at: string;
  emoji: string | null;
}

/** Author only: who viewed, with each viewer's reaction. */
export async function listStatusViewers(statusId: string): Promise<StatusViewer[]> {
  const { data } = await apiClient.get(`/statuses/${statusId}/viewers`);
  return data;
}

export async function reactToStatus(statusId: string, emoji: string) {
  const { data } = await apiClient.put(`/statuses/${statusId}/reaction`, { emoji });
  return data;
}

export async function removeStatusReaction(statusId: string) {
  await apiClient.delete(`/statuses/${statusId}/reaction`);
}
