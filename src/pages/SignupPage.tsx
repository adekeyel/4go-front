import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import AuthFooterLinks from "@/components/AuthFooterLinks";
import TickerBanner from "@/components/TickerBanner";

const REFERRAL_KEY = "4go-referral-code";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem(REFERRAL_KEY, ref);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (phone.trim().length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const referralCode = localStorage.getItem(REFERRAL_KEY) || undefined;
      await signUp({ email: email.trim().toLowerCase(), password, displayName: displayName.trim(), referralCode });
      localStorage.removeItem(REFERRAL_KEY); // the server redeems it once, at signup

      // Persist the phone number now that we have a session. Not part of the
      // signup payload itself since the backend's /auth/signup schema (shared
      // with the native app) doesn't take one.
      await apiClient.patch("/profiles/me", { phone_number: phone.trim() }).catch(() => {});

      toast.success("Welcome to 4go 🎉 Check your email to verify your address.");
      navigate("/setup-profile");
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      toast.error(message || "Couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerBanner />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm animate-slide-up">
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
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
        </div>
      </div>
    </div>
  );
}
