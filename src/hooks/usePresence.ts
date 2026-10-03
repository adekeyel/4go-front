import { useEffect } from "react";
import { apiClient } from "@/lib/apiClient";

/**
 * Tracks user online presence globally via the Railway backend
 * (POST /api/profiles/me/presence), which updates profiles.is_online /
 * last_seen and opportunistically sweeps other stale users offline.
 * No longer triggers profile refresh to avoid cascading re-renders.
 */
export function usePresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const heartbeat = (online: boolean, minutesDelta?: number) => {
      apiClient.post("/profiles/me/presence", { online, minutesDelta }).catch(() => {});
    };

    // Mark online once on mount
    heartbeat(true);

    // Heartbeat every 45s: refresh last_seen so we can detect stale presence.
    // Continue heartbeating even when the tab is hidden so a backgrounded /
    // minimized app keeps the user online (the backend considers anyone with
    // last_seen older than 3 min as offline).
    const heartbeatInterval = window.setInterval(() => heartbeat(true), 45000);

    // Increment online minutes every 60s (only when tab is visible)
    const minuteInterval = window.setInterval(() => {
      if (document.hidden) return;
      heartbeat(true, 1);
    }, 60000);

    const markOffline = () => heartbeat(false);
    const markOnline = () => heartbeat(true);

    // Do NOT mark offline on visibilitychange (minimize / tab switch). Just
    // refresh last_seen so the stale-presence cleanup keeps them online for
    // ~3 minutes. Apps like WhatsApp/Facebook keep you "online" while
    // backgrounded as long as you reconnect periodically.
    const handleVisibilityChange = () => {
      if (!document.hidden) markOnline();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      window.clearInterval(minuteInterval);
      window.clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [userId]);
}
