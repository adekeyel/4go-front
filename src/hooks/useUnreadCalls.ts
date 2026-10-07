import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import * as callsApi from "@/api/calls";

// Every screen that shows a missed-call badge has its own copy of this hook. When one of them marks the calls as
// seen they all need to update at once, so the news travels through the window.
const SEEN_EVENT = "calls:seen-local";

/**
 * Missed calls the person hasn't looked at yet.
 * A missed call stops counting once they open that chat OR open their call history after it happened
 * (the server decides, see GET /api/calls/missed), so the badge clears when you actually look, not at some
 * unrelated moment like the last time the app connected.
 */
export function useUnreadCalls() {
  const { user } = useAuth();
  const socket = useSocket();
  const [totalUnreadCalls, setTotalUnreadCalls] = useState(0);
  const [unreadCallsByRoom, setUnreadCallsByRoom] = useState<Record<string, number>>({});

  const refetch = useCallback(async () => {
    const data = await callsApi.listMissedCalls().catch(() => null);
    if (!data) return; // a failed request shouldn't wipe the badge
    const nextByRoom: Record<string, number> = {};
    for (const row of data) nextByRoom[row.room_id] = (nextByRoom[row.room_id] || 0) + 1;
    setUnreadCallsByRoom(nextByRoom);
    setTotalUnreadCalls(data.length);
  }, []);

  /** Call when the call history is on screen. */
  const markCallsSeen = useCallback(async () => {
    setTotalUnreadCalls(0);
    setUnreadCallsByRoom({});
    try {
      await callsApi.markCallsSeen();
      window.dispatchEvent(new Event(SEEN_EVENT));
    } catch {
      void refetch(); // it didn't save: show the real count again
    }
  }, [refetch]);

  useEffect(() => {
    if (!user?.id) {
      setTotalUnreadCalls(0);
      setUnreadCallsByRoom({});
      return;
    }
    void refetch();

    const onUpdated = () => void refetch(); // a call changed (new missed call, etc.)
    const onSeenSomewhere = () => void refetch(); // another screen / tab / device marked them seen
    const onVisible = () => { if (document.visibilityState === "visible") void refetch(); }; // came back to the app
    socket?.on("call:updated", onUpdated);
    socket?.on("calls:seen", onSeenSomewhere);
    window.addEventListener(SEEN_EVENT, onSeenSomewhere);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      socket?.off("call:updated", onUpdated);
      socket?.off("calls:seen", onSeenSomewhere);
      window.removeEventListener(SEEN_EVENT, onSeenSomewhere);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, socket, refetch]);

  return { totalUnreadCalls, unreadCallsByRoom, markCallsSeen, refetchUnreadCalls: refetch };
}
