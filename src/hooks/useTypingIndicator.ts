import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";

/**
 * Hook for typing indicators in a chat room.
 * Uses the backend's socket.io typing:start/typing:stop events (the room
 * itself is joined by the chat page via socket "room:join").
 */
export function useTypingIndicator(roomId: string | undefined) {
  const { user } = useAuth();
  const socket = useSocket();
  const [typingUsers, setTypingUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastBroadcastRef = useRef(0);

  useEffect(() => {
    if (!roomId || !user || !socket) return;
    const timeoutsMap = typingTimeoutsRef.current;

    const onStart = (payload: { userId: string; displayName: string; roomId: string }) => {
      if (payload.roomId !== roomId || payload.userId === user.id) return;
      setTypingUsers((prev) => (prev.some((t) => t.userId === payload.userId) ? prev : [...prev, payload]));

      const existing = timeoutsMap.get(payload.userId);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((t) => t.userId !== payload.userId));
        timeoutsMap.delete(payload.userId);
      }, 3000);
      timeoutsMap.set(payload.userId, timeout);
    };

    const onStop = (payload: { userId: string; roomId: string }) => {
      if (payload.roomId !== roomId) return;
      const existing = timeoutsMap.get(payload.userId);
      if (existing) clearTimeout(existing);
      timeoutsMap.delete(payload.userId);
      setTypingUsers((prev) => prev.filter((t) => t.userId !== payload.userId));
    };

    socket.on("typing:start", onStart);
    socket.on("typing:stop", onStop);

    return () => {
      timeoutsMap.forEach((t) => clearTimeout(t));
      timeoutsMap.clear();
      socket.off("typing:start", onStart);
      socket.off("typing:stop", onStop);
      setTypingUsers([]);
    };
  }, [roomId, user, socket]);

  const broadcastTyping = useCallback(
    (displayName: string) => {
      if (!socket || !roomId) return;
      const now = Date.now();
      if (now - lastBroadcastRef.current < 2000) return;
      lastBroadcastRef.current = now;
      socket.emit("typing:start", { roomId, displayName });
    },
    [socket, roomId]
  );

  return { typingUsers, broadcastTyping };
}
