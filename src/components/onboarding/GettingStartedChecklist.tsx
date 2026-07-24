import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, X, UserCog, Users2, MessagesSquare, Sparkle } from "lucide-react";

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  icon: typeof UserCog;
  done: boolean;
  path: string;
}

function dismissKey(userId: string) {
  return `4go.checklist.dismissed.${userId}`;
}

interface Props {
  hasJoinedRoom: boolean;
}

export default function GettingStartedChecklist({ hasJoinedRoom }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!user) return;
    try {
      setDismissed(localStorage.getItem(dismissKey(user.id)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [{ count: friends }, { count: posts }] = await Promise.all([
        supabase
          .from("friends")
          .select("id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      if (!cancelled) {
        setFriendCount(friends ?? 0);
        setPostCount(posts ?? 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || dismissed) return null;
  // Wait until we know friend/post counts so the checklist doesn't flash "done".
  if (friendCount === null || postCount === null) return null;

  const hasProfileBasics = Boolean(profile?.username && (profile?.avatar_url || profile?.bio));

  const items: ChecklistItem[] = [
    {
      key: "profile",
      label: "Complete your profile",
      description: "Add a photo and a short bio",
      icon: UserCog,
      done: hasProfileBasics,
      path: "/profile",
    },
    {
      key: "room",
      label: "Join or create a Room",
      description: "Group chats around topics you like",
      icon: MessagesSquare,
      done: hasJoinedRoom,
      path: "/discover",
    },
    {
      key: "friend",
      label: "Add your first friend",
      description: "Find people you may know",
      icon: Users2,
      done: friendCount > 0,
      path: "/add-friend",
    },
    {
      key: "post",
      label: "Share your first post",
      description: "Say hello on the community feed",
      icon: Sparkle,
      done: postCount > 0,
      path: "/feed",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (allDone) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(user.id), "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <Card className="shadow-elevated border-0 overflow-hidden animate-slide-up">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <p className="text-base font-display font-bold text-foreground">
              Get started with 4GO 🚀
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {doneCount}/{items.length} steps done — a couple more and you're all set
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss getting started checklist"
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <Progress value={(doneCount / items.length) * 100} className="h-1.5 mb-3" />

        <div className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                disabled={item.done}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  item.done ? "bg-muted/30" : "bg-muted/40 hover:bg-muted"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.done
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground/70"
                  }`}
                >
                  {item.done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      item.done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
