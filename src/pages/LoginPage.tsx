import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import AuthFooterLinks from "@/components/AuthFooterLinks";
import TickerBanner from "@/components/TickerBanner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerBanner />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">4go</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back 🔥</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-xl"
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-elevated"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <button
          onClick={() => navigate("/forgot-password")}
          className="block text-center text-sm text-primary font-semibold hover:underline mt-4 mx-auto"
        >
          Forgot Password?
        </button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-primary font-semibold hover:underline"
          >
            Sign Up
          </button>
        </p>
        <AuthFooterLinks />
      </div>
    </div>
    </div>
  );
}
