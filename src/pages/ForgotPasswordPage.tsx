import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendResetEmail = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent to your email!");
      navigate("/login");
    }
    setLoading(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      // Check if user has a phone number on file
      const { data: userId } = await supabase.rpc("get_user_id_by_email", { p_email: email });

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone_number")
          .eq("user_id", userId as string)
          .single();

        if (profile?.phone_number) {
          setLoading(false);
          setStep("phone");
          return;
        }
      }

      // No phone number — send reset directly
      await sendResetEmail();
    } catch {
      // On any error, still send the reset email (don't reveal user existence)
      await sendResetEmail();
    }
  };

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data } = await supabase.rpc("verify_reset_phone", {
      p_email: email,
      p_phone: phone,
    });

    if (data === true) {
      await sendResetEmail();
    } else {
      toast.error("Phone number does not match our records");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === "email"
              ? "Enter your email to get started"
              : "Verify your phone number for security"}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
            >
              {loading ? "Checking..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePhoneVerify} className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground mb-2">
              <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <span>Enter the phone number associated with your account for verification</span>
            </div>
            <Input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
            >
              {loading ? "Verifying..." : "Verify & Send Reset Link"}
            </Button>
          </form>
        )}

        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-1 text-sm text-muted-foreground mt-6 mx-auto hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
