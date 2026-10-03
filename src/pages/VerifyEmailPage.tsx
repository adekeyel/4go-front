import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as authApi from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        refreshProfile();
      })
      .catch(() => setStatus("error"));
  }, [token, refreshProfile]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center animate-slide-up">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 mx-auto shadow-elevated">
          {status === "success" ? (
            <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
          ) : status === "error" ? (
            <XCircle className="w-8 h-8 text-primary-foreground" />
          ) : (
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          )}
        </div>

        {status === "verifying" && <p className="text-muted-foreground">Verifying your email...</p>}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Email verified!</h1>
            <p className="text-muted-foreground text-sm mb-6">Your address is confirmed. You're all set.</p>
            <Button onClick={() => navigate("/")} className="rounded-xl">Continue</Button>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Link invalid or expired</h1>
            <p className="text-muted-foreground text-sm mb-6">
              This verification link no longer works. You can keep using your account — verification isn't required to chat.
            </p>
            <Button onClick={() => navigate("/")} className="rounded-xl">Back to app</Button>
          </>
        )}
      </div>
    </div>
  );
}
