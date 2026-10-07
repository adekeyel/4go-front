import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/types/database";

export type CallLog = Tables<"call_logs">;
export type CallType = "voice" | "video";

export async function startCall(roomId: string, calleeId: string, callType: CallType): Promise<CallLog> {
  const { data } = await apiClient.post("/calls", { roomId, calleeId, callType });
  return data;
}

export async function updateCallStatus(
  callId: string,
  status: "answered" | "declined" | "cancelled" | "missed" | "ended",
  durationSeconds?: number
): Promise<CallLog> {
  const { data } = await apiClient.patch(`/calls/${callId}`, { status, duration_seconds: durationSeconds });
  return data;
}

export async function listCallLogs(roomId: string): Promise<CallLog[]> {
  const { data } = await apiClient.get(`/calls/room/${roomId}`);
  return data;
}

export async function listMissedCalls(since?: string | null): Promise<{ id: string; room_id: string; created_at: string }[]> {
  const { data } = await apiClient.get("/calls/missed", { params: since ? { since } : undefined });
  return data;
}

export interface CallHistoryEntry {
  id: string;
  room_id: string;
  /** From my point of view: did I place it or receive it? */
  direction: "outgoing" | "incoming";
  call_type: CallType;
  status: "answered" | "declined" | "cancelled" | "missed" | string;
  duration_seconds: number;
  created_at: string;
  /** The OTHER person. */
  peer: { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };
}

/** My calls across every chat, newest first. Pass the oldest `created_at` you already have as `before` to get the next page. */
export async function getCallHistory(before?: string): Promise<{ calls: CallHistoryEntry[]; hasMore: boolean }> {
  const { data } = await apiClient.get("/calls/history", { params: before ? { before } : undefined });
  return data;
}

/** "I've looked at my call history": clears the missed-call badge. */
export async function markCallsSeen(): Promise<void> {
  await apiClient.post("/calls/seen");
}

/** "Clear call log": hides my history so far (the other people keep theirs). */
export async function clearCallHistory(): Promise<void> {
  await apiClient.post("/calls/clear");
}

/** STUN/TURN servers for calls. The backend adds a TURN relay (with short-lived credentials) when one is configured. */
export async function getIceServers(): Promise<RTCIceServer[]> {
  const { data } = await apiClient.get("/calls/ice-servers");
  return Array.isArray(data?.iceServers) ? data.iceServers : [];
}
