import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UnreadCounts {
  [roomId: string]: number;
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [totalUnreadPersistent, setTotalUnreadPersistent] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;

    // Single RPC call instead of N+1 queries
    const { data } = await supabase.rpc("get_unread_counts", { p_user_id: user.id });

    const counts: UnreadCounts = {};
    let total = 0;
    (data || []).forEach((r: { room_id: string; unread_count: number }) => {
      counts[r.room_id] = r.unread_count;
      total += r.unread_count;
    });

    setUnreadCounts(counts);
    setTotalUnreadPersistent(total);
  }, [user]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Debounced refetch: wait 2s after last new message before re-querying
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUnreadCounts();
    }, 2000);
  }, [fetchUnreadCounts]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread-counter-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;
          // Optimistic increment + debounced full refresh
          setUnreadCounts((prev) => ({
            ...prev,
            [msg.room_id]: (prev[msg.room_id] || 0) + 1,
          }));
          setTotalUnreadPersistent((prev) => prev + 1);
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, debouncedRefetch]);

  return { unreadCounts, totalUnreadPersistent, refetchUnreads: fetchUnreadCounts };
}
