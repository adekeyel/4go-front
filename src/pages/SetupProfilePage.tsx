import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function SetupProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: username.toLowerCase(), bio, phone_number: phone || null })
      .eq("user_id", user.id);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast.error("Username already taken!");
      } else {
        toast.error(error.message);
      }
    } else {
      await refreshProfile();
      toast.success("Profile set up! 🎉");
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground">Set Up Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose a unique username</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Username</label>
            <Input
              type="text"
              placeholder="@cooluser"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              required
              minLength={3}
              maxLength={20}
              className="h-12 rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Phone (optional)</label>
            <Input
              type="tel"
              placeholder="+234..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Bio (optional)</label>
            <Textarea
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
          >
            {loading ? "Saving..." : "Let's Go! 🚀"}
          </Button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
