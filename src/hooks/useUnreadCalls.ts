import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadCalls() {
  const { user, profile } = useAuth();
  const [totalUnreadCalls, setTotalUnreadCalls] = useState(0);
  const [unreadCallsByRoom, setUnreadCallsByRoom] = useState<Record<string, number>>({});
  const lastSeenRef = useRef(profile?.last_seen);
  const channelKeyRef = useRef(`missed-calls-${Math.random().toString(36).slice(2)}`);

  // Keep ref in sync so we don't re-subscribe on every profile change
  useEffect(() => {
    lastSeenRef.current = profile?.last_seen;
  }, [profile?.last_seen]);

  const refetch = useCallback(async (userId: string) => {
    let query = supabase
      .from("call_logs")
      .select("id, room_id, created_at")
      .eq("callee_id", userId)
      .eq("status", "missed");

    if (lastSeenRef.current) {
      query = query.gt("created_at", lastSeenRef.current);
    }

    const { data } = await query;

    const nextByRoom: Record<string, number> = {};
    for (const row of data || []) {
      nextByRoom[row.room_id] = (nextByRoom[row.room_id] || 0) + 1;
    }

    setUnreadCallsByRoom(nextByRoom);
    setTotalUnreadCalls((data || []).length);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setTotalUnreadCalls(0);
      setUnreadCallsByRoom({});
      return;
    }

    const userId = user.id;
    void refetch(userId);

    const channel = supabase
      .channel(`${channelKeyRef.current}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_logs",
          filter: `callee_id=eq.${userId}`,
        },
        () => void refetch(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return { totalUnreadCalls, unreadCallsByRoom };
}