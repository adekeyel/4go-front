import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import AuthFooterLinks from "@/components/AuthFooterLinks";
import TickerBanner from "@/components/TickerBanner";

const REFERRAL_KEY = "4go-referral-code";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem(REFERRAL_KEY, ref);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (phone.trim().length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, phone_number: phone.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("We sent a 6-digit verification code to your email.");
      setStep("otp");
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.trim();
    if (code.length < 6) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    if (error) {
      toast.error(error.message || "Invalid or expired code");
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      // Persist phone number to the profile (now that we have a session)
      await supabase
        .from("profiles")
        .update({ phone_number: phone.trim() })
        .eq("user_id", userId);

      // Process referral if code exists
      const refCode = localStorage.getItem(REFERRAL_KEY);
      if (refCode) {
        await supabase.rpc("process_referral", {
          p_referral_code: refCode,
          p_new_user_id: userId,
        });
        localStorage.removeItem(REFERRAL_KEY);
      }
    }

    toast.success("Email verified! Welcome to 4go 🎉");
    navigate("/setup-profile");
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success("A new code is on its way to your inbox.");
    setResending(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerBanner />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm animate-slide-up">
          {step === "form" ? (
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
                  <MessageCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground">Join 4go</h1>
                <p className="text-muted-foreground text-sm mt-1">Create your account</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
                <Input
                  type="tel"
                  placeholder="Phone number (e.g. +234...)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
                <Input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
              <AuthFooterLinks />
            </>
          ) : (
            <>
              <button
                onClick={() => setStep("form")}
                className="flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
                  <MailCheck className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground text-center">Verify your email</h1>
                <p className="text-muted-foreground text-sm mt-1 text-center">
                  Enter the 6-digit code we sent to
                  <br />
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-semibold"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
                >
                  {loading ? "Verifying..." : "Verify & Continue"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Didn't get the code?{" "}
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-primary font-semibold hover:underline disabled:opacity-60"
                >
                  {resending ? "Sending..." : "Resend"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
