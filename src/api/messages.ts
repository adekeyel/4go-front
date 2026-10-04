import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/integrations/supabase/types";

// Some columns (edited_at, reply_to) may be newer than the generated
// Supabase types snapshot — declared explicitly here, same as ChatRoomPage.
export type Message = Tables<"messages"> & { edited_at?: string | null; reply_to?: string | null };

export async function listMessages(roomId: string, before?: string): Promise<Message[]> {
  const { data } = await apiClient.get(`/messages/room/${roomId}`, { params: before ? { before } : undefined });
  return data;
}

/** Deep-link support: a window of ~50 messages centered on messageId, plus whether older ones exist. */
export async function getMessagesAround(roomId: string, messageId: string): Promise<{ messages: Message[]; hasMoreBefore: boolean }> {
  const { data } = await apiClient.get(`/messages/room/${roomId}/around/${messageId}`);
  return data;
}

/** On entering a room: jump to the first unread message after `after`, or the latest page if there's nothing unread. */
export async function getUnreadMessages(roomId: string, after: string | null): Promise<{ messages: Message[]; hasMore: boolean }> {
  const { data } = await apiClient.get(`/messages/room/${roomId}/unread`, { params: after ? { after } : undefined });
  return data;
}

export async function getMessagesByIds(roomId: string, ids: string[]): Promise<Message[]> {
  if (!ids.length) return [];
  const { data } = await apiClient.get(`/messages/room/${roomId}/by-ids`, { params: { ids: ids.join(",") } });
  return data;
}

export async function sendMessage(
  roomId: string,
  input: { type?: Message["type"]; content?: string; media_url?: string; duration?: number; reply_to?: string }
): Promise<Message> {
  const { data } = await apiClient.post(`/messages/room/${roomId}`, input);
  return data;
}

export async function editMessage(messageId: string, content: string): Promise<Message> {
  const { data } = await apiClient.patch(`/messages/${messageId}`, { content });
  return data;
}

export async function deleteMessage(messageId: string) {
  await apiClient.delete(`/messages/${messageId}`);
}

export async function reactToMessage(messageId: string, emoji: string) {
  const { data } = await apiClient.post(`/messages/${messageId}/reactions`, { emoji });
  return data;
}

export interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export async function listMessageReactions(messageId: string): Promise<ReactionRow[]> {
  const { data } = await apiClient.get(`/messages/${messageId}/reactions`);
  return data;
}

export async function removeReaction(messageId: string, emoji: string) {
  await apiClient.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
}

/** Records that the signed-in user viewed a message. Returns the running view count when it was counted. */
export async function recordMessageView(messageId: string): Promise<{ view_count?: number; self_view?: boolean; already_viewed?: boolean; recorded?: boolean }> {
  const { data } = await apiClient.post(`/messages/${messageId}/view`);
  return data;
}

/** View counts for the caller's own messages in a room. */
export async function getMessageViewCounts(roomId: string, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const { data } = await apiClient.get(`/messages/room/${roomId}/views`, { params: { ids: ids.join(",") } });
  return data;
}
