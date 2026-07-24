import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquare,
  Flame,
  Wallet,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

interface TourStep {
  icon: typeof Users;
  title: string;
  description: string;
  actionLabel: string;
  path: string;
}

const STEPS: TourStep[] = [
  {
    icon: Users,
    title: "Join a Room",
    description:
      "Rooms are group chats built around a topic or vibe. Jump into a trending room, or create your own in seconds.",
    actionLabel: "Browse Rooms",
    path: "/discover",
  },
  {
    icon: Flame,
    title: "Share on the Feed",
    description:
      "Post photos, thoughts, or updates to the community feed. Like, comment, and see what everyone's talking about.",
    actionLabel: "Open Feed",
    path: "/feed",
  },
  {
    icon: MessageSquare,
    title: "Chat One-on-One",
    description:
      "Add friends and send direct messages, voice notes, or start a call — all in one place.",
    actionLabel: "Add a Friend",
    path: "/add-friend",
  },
  {
    icon: Wallet,
    title: "Earn Coins & Go Premium",
    description:
      "Stay active to earn coins, unlock rewards, and upgrade to 4GO Premium for an ad-free, verified experience.",
    actionLabel: "See My Wallet",
    path: "/wallet",
  },
];

function storageKey(userId: string) {
  return `4go.tour.seen.${userId}`;
}

/** Returns true if this user has never seen the welcome tour before. */
export function shouldShowWelcomeTour(userId: string): boolean {
  try {
    return !localStorage.getItem(storageKey(userId));
  } catch {
    return false;
  }
}

export default function WelcomeTourModal() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user || !profile) return;
    if (shouldShowWelcomeTour(user.id)) {
      // Small delay so this doesn't compete with the initial page render.
      const t = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [user, profile]);

  const dismiss = () => {
    if (user) {
      try {
        localStorage.setItem(storageKey(user.id), "1");
      } catch {
        // ignore storage failures (private mode, etc.)
      }
    }
    setOpen(false);
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="gradient-hero px-6 pt-8 pb-10 text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-display font-bold text-primary-foreground">
            {current.title}
          </h2>
        </div>

        <div className="px-6 pt-5 pb-6">
          <p className="text-sm text-muted-foreground text-center leading-relaxed min-h-[60px]">
            {current.description}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 my-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl shrink-0"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="secondary"
              className="flex-1 rounded-xl"
              onClick={() => {
                dismiss();
                navigate(current.path);
              }}
            >
              {current.actionLabel}
            </Button>
            <Button
              className="flex-1 rounded-xl gradient-primary text-primary-foreground"
              onClick={() => {
                if (isLast) {
                  dismiss();
                } else {
                  setStep((s) => s + 1);
                }
              }}
            >
              {isLast ? (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Let's go
                </span>
              ) : (
                "Next"
              )}
            </Button>
          </div>

          <button
            onClick={dismiss}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4"
          >
            Skip intro
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
