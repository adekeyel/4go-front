import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import * as roomsApi from "@/api/rooms";

export interface UnreadCounts {
  [roomId: string]: number;
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const socket = useSocket();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [totalUnreadPersistent, setTotalUnreadPersistent] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;
    const data = await roomsApi.getUnreadCounts().catch(() => []);
    const counts: UnreadCounts = {};
    let total = 0;
    data.forEach((r) => {
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

  // The backend pushes "message:notify" to this user's personal socket room
  // for every new message in any room they belong to (not just the open one).
  useEffect(() => {
    if (!user || !socket) return;

    const onNotify = (msg: { roomId: string; senderId: string }) => {
      if (msg.senderId === user.id) return;
      setUnreadCounts((prev) => ({ ...prev, [msg.roomId]: (prev[msg.roomId] || 0) + 1 }));
      setTotalUnreadPersistent((prev) => prev + 1);
      debouncedRefetch();
    };

    socket.on("message:notify", onNotify);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      socket.off("message:notify", onNotify);
    };
  }, [user, socket, debouncedRefetch]);

  return { unreadCounts, totalUnreadPersistent, refetchUnreads: fetchUnreadCounts };
}
