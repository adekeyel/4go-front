import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { extractMentionHandles } from "@/lib/mentions";

/**
 * Resolves @handles to user_ids and inserts mention rows. Trigger fires push.
 */
export function useMentionRecorder() {
  const { user } = useAuth();

  const recordFromText = useCallback(
    async (
      text: string,
      params: {
        sourceType: "message" | "comment" | "post";
        sourceId: string;
        contextId: string; // room_id for messages, post_id for comments/posts
      }
    ) => {
      if (!user || !text) return;
      const handles = extractMentionHandles(text);
      if (handles.length === 0) return;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("username", handles);

      const ids = (profiles || [])
        .map((p) => p.user_id)
        .filter((id): id is string => Boolean(id) && id !== user.id);
      if (ids.length === 0) return;

      await supabase.rpc("record_mentions", {
        p_mentioner_id: user.id,
        p_mentioned_ids: ids,
        p_source_type: params.sourceType,
        p_source_id: params.sourceId,
        p_context_id: params.contextId,
        p_preview: text.slice(0, 200),
      });
    },
    // user?.id (primitive) used deliberately; only user.id is read from the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id]
  );

  return { recordFromText };
}
