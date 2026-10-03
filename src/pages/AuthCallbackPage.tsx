import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Legacy route from the Supabase OAuth/PKCE flow. The new backend is
// email/password only (no OAuth redirect, no hash-token exchange), so
// nothing should actually land here anymore — this just sends visitors
// somewhere sensible if an old bookmark or cached link does.
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate(user ? "/" : "/login", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
