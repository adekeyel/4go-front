import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks the count of unread mentions (mentions.read_at IS NULL) for the current user
 * with a realtime subscription. Returns the count and a setter for optimistic clearing.
 */
export function useUnreadMentions() {
  const { user } = useAuth();
  const [unreadMentions, setUnreadMentions] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadMentions(0);
      return;
    }

    let mounted = true;

    const refetch = async () => {
      const { count } = await supabase
        .from("mentions")
        .select("id", { count: "exact", head: true })
        .eq("mentioned_user_id", user.id)
        .is("read_at", null);
      if (mounted) setUnreadMentions(count ?? 0);
    };

    refetch();

    const channel = supabase
      .channel(`mentions-unread-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mentions",
          filter: `mentioned_user_id=eq.${user.id}`,
        },
        () => mounted && setUnreadMentions((c) => c + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mentions",
          filter: `mentioned_user_id=eq.${user.id}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { unreadMentions, setUnreadMentions };
}
