import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import * as callsApi from "@/api/calls";

export function useUnreadCalls() {
  const { user, profile } = useAuth();
  const socket = useSocket();
  const [totalUnreadCalls, setTotalUnreadCalls] = useState(0);
  const [unreadCallsByRoom, setUnreadCallsByRoom] = useState<Record<string, number>>({});
  const lastSeenRef = useRef(profile?.last_seen);

  // Keep ref in sync so we don't re-subscribe on every profile change
  useEffect(() => {
    lastSeenRef.current = profile?.last_seen;
  }, [profile?.last_seen]);

  const refetch = useCallback(async () => {
    const data = await callsApi.listMissedCalls(lastSeenRef.current).catch(() => []);
    const nextByRoom: Record<string, number> = {};
    for (const row of data) {
      nextByRoom[row.room_id] = (nextByRoom[row.room_id] || 0) + 1;
    }
    setUnreadCallsByRoom(nextByRoom);
    setTotalUnreadCalls(data.length);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setTotalUnreadCalls(0);
      setUnreadCallsByRoom({});
      return;
    }
    void refetch();

    // Backend pushes "call:updated" to the callee whenever a call log changes.
    const onUpdated = () => void refetch();
    socket?.on("call:updated", onUpdated);
    return () => {
      socket?.off("call:updated", onUpdated);
    };
  }, [user?.id, socket, refetch]);

  return { totalUnreadCalls, unreadCallsByRoom };
}
