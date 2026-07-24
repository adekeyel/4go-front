import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, ShieldBan, UserCircle2, Info, FileText, LifeBuoy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import { fetchBlockedUsers, unblockUser } from "@/lib/safety";
import { toast } from "sonner";

const SOUND_KEY = "4go-notification-sound";

interface BlockedProfile {
  blocked_id: string;
  reason: string | null;
  created_at: string;
  profile?: {
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissionGranted, requestPermission, subscribeToPush } = useNotificationContext();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedProfile[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off");
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadBlockedUsers();
  }, [user]);

  const notificationStatus = useMemo(() => {
    if (permissionGranted) return "Browser alerts enabled";
    return "Browser alerts disabled";
  }, [permissionGranted]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocks(true);

    const { data, error } = await fetchBlockedUsers(user.id);
    if (error) {
      toast.error("Couldn't load blocked users");
      setLoadingBlocks(false);
      return;
    }

    const blockedIds = (data || []).map((item: BlockedProfile) => item.blocked_id);
    if (blockedIds.length === 0) {
      setBlockedUsers([]);
      setLoadingBlocks(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", blockedIds);

    const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]));
    setBlockedUsers(
      (data || []).map((item: BlockedProfile) => ({
        ...item,
        profile: profileMap.get(item.blocked_id),
      }))
    );
    setLoadingBlocks(false);
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    setBusyId(blockedId);
    const { error } = await unblockUser(user.id, blockedId);
    if (error) toast.error("Couldn't unblock user");
    else {
      setBlockedUsers((current) => current.filter((entry) => entry.blocked_id !== blockedId));
      toast.success("User unblocked");
    }
    setBusyId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-display font-bold text-primary-foreground">Settings</h1>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Profile</p>
              <p className="text-xs text-muted-foreground">Edit your details and photo.</p>
            </div>
            <UserCircle2 className="w-5 h-5 text-primary" />
          </div>
          <Button className="mt-4 w-full" onClick={() => navigate("/setup-profile")}>Edit profile</Button>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">{notificationStatus}</p>
            </div>
            <BellRing className="w-5 h-5 text-primary" />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-3 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Notification sound</p>
              <p className="text-xs text-muted-foreground">Play a sound for new chats and requests.</p>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={handleSoundToggle} />
          </div>

          <Button variant="outline" className="mt-3 w-full" onClick={async () => {
            const granted = await requestPermission();
            if (granted) await subscribeToPush();
          }}>
            Enable browser notifications
          </Button>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Safety</p>
              <p className="text-xs text-muted-foreground">Manage the people you blocked.</p>
            </div>
            <ShieldBan className="w-5 h-5 text-primary" />
          </div>

          <div className="mt-4 space-y-3">
            {loadingBlocks ? (
              <p className="text-sm text-muted-foreground">Loading blocked users...</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
            ) : (
              blockedUsers.map((entry) => (
                <div key={entry.blocked_id} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                  <UserAvatar
                    name={entry.profile?.display_name || entry.profile?.username}
                    url={entry.profile?.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {entry.profile?.display_name || "User"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.profile?.username ? `@${entry.profile.username}` : entry.reason || "Blocked user"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === entry.blocked_id}
                    onClick={() => void handleUnblock(entry.blocked_id)}
                  >
                    {busyId === entry.blocked_id ? "..." : "Unblock"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-card space-y-1">
          <p className="text-sm font-semibold text-foreground mb-3">More</p>
          {[
            { icon: Info, label: "About 4GO", path: "/about" },
            { icon: FileText, label: "Privacy Policy", path: "/privacy" },
            { icon: LifeBuoy, label: "Support / Help Center", path: "/support" },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted transition-colors"
            >
              <item.icon className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground flex-1 text-left">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}