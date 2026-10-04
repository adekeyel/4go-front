import { apiClient } from "@/lib/apiClient";

export interface SupportConversation {
  id: string;
  user_id: string;
  subject: string | null;
  status: string;
  assigned_agent_id: string | null;
  unread_for_user: number;
  unread_for_agent: number;
  last_message_at: string;
  created_at: string;
  user?: { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; rank?: string; is_verified?: boolean };
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  is_agent: boolean;
  content: string;
  created_at: string;
}

/** Your own conversations, newest activity first. */
export async function listMyConversations(): Promise<SupportConversation[]> {
  const { data } = await apiClient.get("/support/conversations");
  return data;
}

/** Support staff: everyone's conversations. */
export async function listAgentConversations(opts: { status?: string; assigned?: "me"; limit?: number; offset?: number } = {}): Promise<SupportConversation[]> {
  const { data } = await apiClient.get("/support/conversations", { params: { view: "agent", ...opts } });
  return data;
}

/** A conversation is created together with its first message. */
export async function createConversation(message: string, subject?: string): Promise<{ conversation: SupportConversation; message: SupportMessage }> {
  const { data } = await apiClient.post("/support/conversations", { message, ...(subject ? { subject } : {}) });
  return data;
}

export async function getConversation(conversationId: string): Promise<SupportConversation> {
  const { data } = await apiClient.get(`/support/conversations/${conversationId}`);
  return data;
}

export async function listSupportMessages(conversationId: string): Promise<SupportMessage[]> {
  const { data } = await apiClient.get(`/support/conversations/${conversationId}/messages`);
  return data;
}

/** The server decides whether the sender is an agent; never send `is_agent`. */
export async function sendSupportMessage(conversationId: string, content: string): Promise<SupportMessage> {
  const { data } = await apiClient.post(`/support/conversations/${conversationId}/messages`, { content });
  return data;
}

export async function markSupportRead(conversationId: string) {
  await apiClient.post(`/support/conversations/${conversationId}/read`);
}

export async function setSupportStatus(conversationId: string, status: "open" | "escalated" | "closed" | "resolved") {
  const { data } = await apiClient.patch(`/support/conversations/${conversationId}/status`, { status });
  return data;
}
