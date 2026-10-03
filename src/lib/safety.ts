import { apiClient } from "@/lib/apiClient";

interface BlockUserParams {
  blockerId: string;
  blockedId: string;
  reason?: string;
}

interface ModerationReportParams {
  reporterId: string;
  reason: string;
  details?: string;
  targetUserId?: string;
  targetRoomId?: string;
  targetMessageId?: string;
}

// blockerId is unused now (the backend infers it from the auth token) but
// kept in the signature so every existing call site stays unchanged.
export async function blockUser({ blockedId, reason }: BlockUserParams) {
  try {
    await apiClient.post("/friends/block", { blockedId, reason: reason?.trim() || undefined });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function unblockUser(_blockerId: string, blockedId: string) {
  try {
    await apiClient.delete(`/friends/block/${blockedId}`);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function fetchBlockedUsers(_blockerId: string) {
  try {
    const { data } = await apiClient.get("/friends/block");
    return { data, error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function submitModerationReport({
  reason,
  details,
  targetUserId,
  targetRoomId,
  targetMessageId,
}: ModerationReportParams) {
  try {
    await apiClient.post("/moderation/reports", {
      targetUserId: targetUserId || undefined,
      targetRoomId: targetRoomId || undefined,
      targetMessageId: targetMessageId || undefined,
      reason: reason.trim(),
      details: details?.trim() || undefined,
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}
