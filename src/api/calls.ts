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
  status: "answered" | "declined" | "cancelled" | "missed",
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
