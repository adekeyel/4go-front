import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import * as mentionsApi from "@/api/mentions";

/**
 * Tracks the count of unread mentions for the current user, kept live by the
 * backend's "mention:new" socket event. Returns the count and a setter for
 * optimistic clearing.
 */
export function useUnreadMentions() {
  const { user } = useAuth();
  const socket = useSocket();
  const [unreadMentions, setUnreadMentions] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadMentions(0);
      return;
    }
    let mounted = true;
    mentionsApi
      .getUnreadMentionCount()
      .then((n) => mounted && setUnreadMentions(n))
      .catch(() => {});

    const onNew = () => mounted && setUnreadMentions((c) => c + 1);
    socket?.on("mention:new", onNew);

    return () => {
      mounted = false;
      socket?.off("mention:new", onNew);
    };
  }, [user, socket]);

  return { unreadMentions, setUnreadMentions };
}
