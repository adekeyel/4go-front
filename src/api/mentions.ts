import { apiClient } from "@/lib/apiClient";

export interface MentionRow {
  id: string;
  mentioner_id: string;
  source_type: string;
  source_id: string;
  context_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
  mentioner?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

export async function recordMentions(input: {
  handles: string[];
  sourceType: "message" | "comment" | "post";
  sourceId: string;
  contextId?: string;
  preview?: string;
}) {
  const { data } = await apiClient.post("/mentions", input);
  return data;
}

export async function listMentions(): Promise<MentionRow[]> {
  const { data } = await apiClient.get("/mentions");
  return data;
}

export async function getUnreadMentionCount(): Promise<number> {
  const { data } = await apiClient.get("/mentions/unread-count");
  return data.count;
}

export async function markMentionsRead() {
  await apiClient.post("/mentions/read");
}
