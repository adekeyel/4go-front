import { apiClient } from "@/lib/apiClient";

export async function submitReport(input: {
  targetUserId?: string;
  targetRoomId?: string;
  targetMessageId?: string;
  reason: string;
  details?: string;
}) {
  const { data } = await apiClient.post("/moderation/reports", input);
  return data;
}
