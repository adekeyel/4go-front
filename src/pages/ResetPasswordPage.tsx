import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [hasCode, setHasCode] = useState(false);
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if there's a code but DON'T auto-exchange it (prevents prefetcher consumption)
  useEffect(() => {
    const code = searchParams.get("code");
    const hash = window.location.hash;

    if (code) {
      setHasCode(true);
      setExchanging(false);
    } else if (hash && hash.includes("type=recovery")) {
      setIsValidSession(true);
      setExchanging(false);
    } else {
      setExchanging(false);
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsValidSession(true);
          setExchanging(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleExchangeCode = useCallback(async () => {
    const code = searchParams.get("code");
    if (!code) return;

    setLoading(true);
    setExchangeError("");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      setIsValidSession(true);
    } else {
      setExchangeError(error.message);
      toast.error("Link expired or already used. Please request a new one.");
    }
    setLoading(false);
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/");
    }
    setLoading(false);
  };

  if (exchanging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isValidSession && hasCode && !exchangeError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 mx-auto shadow-elevated">
            <KeyRound className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Reset Your Password</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Tap the button below to continue resetting your password.
          </p>
          <Button
            onClick={handleExchangeCode}
            disabled={loading}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
          >
            {loading ? "Verifying..." : "Continue to Reset Password"}
          </Button>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 mx-auto shadow-elevated">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Invalid Link</h1>
          <p className="text-muted-foreground text-sm mb-6">
            {exchangeError || "This password reset link is invalid or has expired."}
          </p>
          <Button onClick={() => navigate("/forgot-password")} className="rounded-xl">
            Request New Link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">New Password</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter your new password below</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="h-12 rounded-xl"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
