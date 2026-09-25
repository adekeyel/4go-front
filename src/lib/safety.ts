import { supabase } from "@/integrations/supabase/client";

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

export async function blockUser({ blockerId, blockedId, reason }: BlockUserParams) {
  const result = await supabase.from("user_blocks").upsert(
    {
      blocker_id: blockerId,
      blocked_id: blockedId,
      reason: reason?.trim() || null,
    },
    { onConflict: "blocker_id,blocked_id" }
  );

  if (!result.error) {
    await supabase
      .from("friends")
      .delete()
      .or(
        `and(requester_id.eq.${blockerId},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${blockerId})`
      );
  }

  return result;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
}

export async function fetchBlockedUsers(blockerId: string) {
  return supabase
    .from("user_blocks")
    .select("blocked_id, reason, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
}

export async function submitModerationReport({
  reporterId,
  reason,
  details,
  targetUserId,
  targetRoomId,
  targetMessageId,
}: ModerationReportParams) {
  return supabase.from("moderation_reports").insert({
    reporter_id: reporterId,
    target_user_id: targetUserId || null,
    target_room_id: targetRoomId || null,
    target_message_id: targetMessageId || null,
    reason: reason.trim(),
    details: details?.trim() || null,
  });
}