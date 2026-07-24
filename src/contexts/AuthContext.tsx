import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { usePresence } from "@/hooks/usePresence";

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // True only when the user explicitly taps "log out". Used to distinguish a
  // real sign-out from a spurious SIGNED_OUT emitted after a transient/blocked
  // token-refresh request (common on desktop with privacy/ad-block extensions).
  const userInitiatedSignOut = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data || null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [fetchProfile, user]);

  useEffect(() => {
    let recovering = false;

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setTimeout(() => fetchProfile(nextSession.user.id), 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.info(
          `[auth] ${event} @ ${new Date().toISOString()} hasSession=${!!session} userInitiated=${userInitiatedSignOut.current}`,
        );

        // A null session that we did NOT initiate is usually a transient
        // failure (blocked/failed token refresh), not a real logout. Verify
        // before tearing down the UI so users aren't bounced to /login.
        // Recovery runs in a deferred task (not inside this callback) to avoid
        // the supabase-js auth deadlock when calling auth methods synchronously.
        if (!session && event === "SIGNED_OUT" && !userInitiatedSignOut.current) {
          if (recovering) return;
          recovering = true;
          setTimeout(async () => {
            try {
              const { data: { session: recovered } } = await supabase.auth.getSession();
              if (recovered) {
                console.info("[auth] recovered session via getSession, ignoring spurious SIGNED_OUT");
                applySession(recovered);
                return;
              }
              const { data: refreshed } = await supabase.auth.refreshSession();
              if (refreshed?.session) {
                console.info("[auth] recovered session via refreshSession, ignoring spurious SIGNED_OUT");
                applySession(refreshed.session);
                return;
              }
              console.warn("[auth] session could not be recovered, clearing");
              applySession(null);
            } catch (err) {
              console.warn("[auth] session recovery failed", err);
              applySession(null);
            } finally {
              recovering = false;
            }
          }, 0);
          // Do not clear the user yet — wait for the recovery attempt above.
          return;
        }

        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.info(`[auth] initial getSession hasSession=${!!session}`);
      applySession(session);
    });

    // Handle auth tokens in URL hash (iOS email verification redirect)
    const hash = window.location.hash;
    if (hash && (hash.includes("access_token") || hash.includes("type=recovery"))) {
      // Clear hash after Supabase processes it to avoid re-processing
      const cleanup = setTimeout(() => {
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }, 1000);
      return () => { subscription.unsubscribe(); clearTimeout(cleanup); };
    }

    return () => subscription.unsubscribe();
  }, []);

  // Realtime: keep our own profile (premium/verified flags, coins, rank, etc.) in sync
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-self-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setProfile((prev) => ({ ...(prev as Profile), ...(payload.new as Profile) }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Refresh own profile when an active subscription or verification record changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`status-self-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => fetchProfile(user.id),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "verification_applications", filter: `user_id=eq.${user.id}` },
        () => fetchProfile(user.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchProfile]);

  const signOut = async () => {
    userInitiatedSignOut.current = true;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    // Allow future spurious SIGNED_OUT events to be treated as transient again.
    setTimeout(() => { userInitiatedSignOut.current = false; }, 2000);
  };

  // Track online presence globally
  usePresence(user?.id ?? null);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
