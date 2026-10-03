import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { extractMentionHandles } from "@/lib/mentions";
import * as mentionsApi from "@/api/mentions";

/**
 * Extracts @handles from text and asks the backend to resolve them to users,
 * store mention rows, and notify each mentioned user live.
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
      await mentionsApi
        .recordMentions({
          handles,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          contextId: params.contextId,
          preview: text.slice(0, 200),
        })
        .catch(() => {});
    },
    // user?.id (primitive) used deliberately; only user.id is read from the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id]
  );

  return { recordFromText };
}
