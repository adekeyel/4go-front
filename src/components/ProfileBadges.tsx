import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PremiumBadge from "@/components/PremiumBadge";
import VerifiedIdentityBadge from "@/components/VerifiedIdentityBadge";

type Flags = { is_premium: boolean; is_verified: boolean };

const cache = new Map<string, Flags>();
const inflight = new Map<string, Promise<Flags>>();
const listeners = new Map<string, Set<(f: Flags) => void>>();
const realtimeIds = new Set<string>();

function notify(userId: string, flags: Flags) {
  cache.set(userId, flags);
  listeners.get(userId)?.forEach((cb) => cb(flags));
}

function fetchFlags(userId: string): Promise<Flags> {
  if (cache.has(userId)) return Promise.resolve(cache.get(userId)!);
  const existing = inflight.get(userId);
  if (existing) return existing;
  const p = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("is_premium, is_verified")
      .eq("user_id", userId)
      .maybeSingle();
    const flags: Flags = {
      is_premium: !!data?.is_premium,
      is_verified: !!data?.is_verified,
    };
    notify(userId, flags);
    inflight.delete(userId);
    return flags;
  })();
  inflight.set(userId, p);
  return p;
}

function ensureRealtime(userId: string) {
  if (realtimeIds.has(userId)) return;
  realtimeIds.add(userId);
  supabase
    .channel(`profile-flags-${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as { is_premium?: boolean; is_verified?: boolean };
        notify(userId, {
          is_premium: !!n.is_premium,
          is_verified: !!n.is_verified,
        });
      }
    )
    .subscribe();
}

interface Props {
  userId: string | null | undefined;
  /** Optional preloaded flags so we can render instantly (e.g. when query already fetched them). */
  preset?: Partial<Flags> | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}

/**
 * Renders Verified + Premium badges next to a user's name everywhere in the app.
 * Uses a shared in-memory cache + realtime so all instances stay in sync.
 */
export default function ProfileBadges({ userId, preset, size = "sm", className }: Props) {
  const initial: Flags | null = preset
    ? { is_premium: !!preset.is_premium, is_verified: !!preset.is_verified }
    : userId
    ? cache.get(userId) ?? null
    : null;
  const [flags, setFlags] = useState<Flags | null>(initial);

  useEffect(() => {
    if (!userId) return;
    if (preset) {
      cache.set(userId, { is_premium: !!preset.is_premium, is_verified: !!preset.is_verified });
    }
    let cancelled = false;
    fetchFlags(userId).then((f) => {
      if (!cancelled) setFlags(f);
    });
    const set = listeners.get(userId) ?? new Set();
    const cb = (f: Flags) => setFlags(f);
    set.add(cb);
    listeners.set(userId, set);
    ensureRealtime(userId);
    return () => {
      cancelled = true;
      set.delete(cb);
    };
    // Depend on preset's primitive fields, not the object reference, so a new
    // preset object with the same values doesn't re-trigger the realtime subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, preset?.is_premium, preset?.is_verified]);

  if (!flags || (!flags.is_premium && !flags.is_verified)) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className ?? ""}`}>
      {flags.is_verified && <VerifiedIdentityBadge size={size} />}
      {flags.is_premium && <PremiumBadge size={size} />}
    </span>
  );
}