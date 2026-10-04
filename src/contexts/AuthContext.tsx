import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import * as authApi from "@/api/auth";
import { apiClient, setSessionExpiredHandler } from "@/lib/apiClient";
import { setAccessToken } from "@/lib/tokenStore";
import { Tables } from "@/types/database";
import { usePresence } from "@/hooks/usePresence";
import { unregisterPushDevice } from "@/lib/pushDevice";

type Profile = Tables<"profiles">;

// Kept minimal and Supabase-shaped on purpose: ~90 other files were written
// against `user?.id` from the old Supabase session object, and that's the
// only field any of them actually read. Preserving this shape means this is
// the only file that needed to change for those call sites to keep working.
interface MinimalUser {
  id: string;
  email: string | null;
}

interface AuthContextType {
  user: MinimalUser | null;
  session: { accessToken: string } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; username?: string; displayName?: string; referralCode?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MinimalUser | null>(null);
  const [session, setSession] = useState<{ accessToken: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyMe = useCallback((me: authApi.Me, accessToken: string) => {
    setUser({ id: me.id, email: me.email });
    setSession({ accessToken });
    setProfile(me.profile);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const me = await authApi.fetchMe();
      setProfile(me.profile);
    } catch (err) {
      console.warn("[auth] refreshProfile failed", err);
    }
  }, [user]);

  // On first load there's no access token in memory yet (a page refresh
  // loses it), so silently redeem the httpOnly refresh cookie for a new one
  // before deciding whether the person is logged in. This is the standard
  // "silent refresh on boot" pattern for cookie-based JWT auth.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.post("/auth/refresh");
        setAccessToken(data.accessToken);
        const me = await authApi.fetchMe();
        if (!cancelled) applyMe(me, data.accessToken);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applyMe, clearSession]);

  // If a refresh ever fails outright after boot (revoked session, expired
  // cookie), the api client calls this so the UI drops back to logged-out
  // rather than silently failing every subsequent request.
  useEffect(() => {
    setSessionExpiredHandler(() => clearSession());
  }, [clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    const me = await authApi.fetchMe();
    applyMe(me, data.accessToken);
  }, [applyMe]);

  const signUp = useCallback(async (input: { email: string; password: string; username?: string; displayName?: string; referralCode?: string }) => {
    const data = await authApi.signup(input);
    const me = await authApi.fetchMe();
    applyMe(me, data.accessToken);
  }, [applyMe]);

  const signOut = useCallback(async () => {
    await unregisterPushDevice(); // before the token is gone, so this phone stops getting the old account's pushes
    await authApi.logout().catch(() => {});
    clearSession();
  }, [clearSession]);

  // Track online presence globally
  usePresence(user?.id ?? null);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
