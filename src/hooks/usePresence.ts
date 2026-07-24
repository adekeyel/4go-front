import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks user online presence globally.
 * Updates profiles.is_online and last_seen.
 * No longer triggers profile refresh to avoid cascading re-renders.
 */
export function usePresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    // Mark online once on mount
    supabase
      .from("profiles")
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq("user_id", userId)
      .then();

    // Heartbeat every 45s: refresh last_seen so we can detect stale presence.
    // Continue heartbeating even when the tab is hidden so a backgrounded /
    // minimized app keeps the user online (the DB considers anyone with
    // last_seen older than 3 min as offline).
    const heartbeatInterval = window.setInterval(() => {
      supabase
        .from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("user_id", userId)
        .then();
      // Opportunistically clean up any other users that went stale.
      supabase.rpc("cleanup_stale_presence").then();
    }, 45000);

    // Increment online minutes every 60s (only when tab is visible)
    const minuteInterval = window.setInterval(() => {
      if (document.hidden) return;
      supabase.rpc("increment_online_minutes", { p_user_id: userId, p_minutes: 1 }).then();
    }, 60000);

    const markOffline = () => {
      supabase
        .from("profiles")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("user_id", userId)
        .then();
    };

    const markOnline = () => {
      supabase
        .from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("user_id", userId)
        .then();
    };

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
