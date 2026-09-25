import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FriendRequest {
  id: string;
  requester_id: string;
  status: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

export default function FriendRequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friends")
      .select("*")
      .eq("addressee_id", user.id)
      .eq("status", "pending");

    if (data && data.length > 0) {
      const ids = data.map((r) => r.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      setRequests(
        data.map((r) => ({ ...r, profile: profileMap.get(r.requester_id) || undefined }))
      );
    } else {
      setRequests([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchRequests();
  }, [user, fetchRequests]);

  const respond = async (id: string, status: "accepted" | "declined") => {
    const { error } = await supabase.from("friends").update({ status }).eq("id", id);
    if (error) {
      toast.error("Failed to respond");
    } else {
      toast.success(status === "accepted" ? "Friend added! 🎉" : "Request declined");
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-display font-bold text-primary-foreground">Friend Requests</h1>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {loading && <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>}
        {!loading && requests.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No pending requests</p>
        )}
        {requests.map((req) => (
          <div key={req.id} className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-card">
            <UserAvatar
              name={req.profile?.display_name || req.profile?.username}
              url={req.profile?.avatar_url}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{req.profile?.display_name}</p>
              {req.profile?.username && <p className="text-xs text-muted-foreground">@{req.profile.username}</p>}
            </div>
            <div className="flex gap-1.5">
              <Button size="icon" variant="ghost" onClick={() => respond(req.id, "accepted")} className="h-9 w-9 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => respond(req.id, "declined")} className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
