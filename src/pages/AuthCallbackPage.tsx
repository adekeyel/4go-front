import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = async () => {
      try {
        // Check for code in URL params (PKCE flow)
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorDesc = params.get("error_description");

        if (errorDesc) {
          setError(errorDesc);
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setError(error.message);
            setTimeout(() => navigate("/login", { replace: true }), 3000);
            return;
          }
        }

        // Check for hash tokens (implicit flow / email verification)
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          // Supabase client auto-detects hash tokens via getSession
          await supabase.auth.getSession();
        }

        // Check current session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      }
    };

    handle();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="text-destructive font-semibold mb-2">Authentication Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
}