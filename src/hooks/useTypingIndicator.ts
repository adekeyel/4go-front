import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook for typing indicators in a chat room.
 * Uses Supabase Realtime broadcast (no DB writes).
 */
export function useTypingIndicator(roomId: string | undefined) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastBroadcastRef = useRef(0);

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`typing-${roomId}`);

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return;

        setTypingUsers((prev) => {
          const exists = prev.some((t) => t.userId === payload.userId);
          if (!exists) {
            return [...prev, { userId: payload.userId, displayName: payload.displayName }];
          }
          return prev;
        });

        // Clear previous timeout for this user
        const existing = typingTimeoutsRef.current.get(payload.userId);
        if (existing) clearTimeout(existing);

        // Remove after 3 seconds of no typing
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((t) => t.userId !== payload.userId));
          typingTimeoutsRef.current.delete(payload.userId);
        }, 3000);

        typingTimeoutsRef.current.set(payload.userId, timeout);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      typingTimeoutsRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current.clear();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, user]);

  const broadcastTyping = useCallback(
    (displayName: string) => {
      if (!channelRef.current || !user) return;
      // Throttle: only broadcast every 2 seconds
      const now = Date.now();
      if (now - lastBroadcastRef.current < 2000) return;
      lastBroadcastRef.current = now;

      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, displayName },
      });
    },
    [user]
  );

  return { typingUsers, broadcastTyping };
}
