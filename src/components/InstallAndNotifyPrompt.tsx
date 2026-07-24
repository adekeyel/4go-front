import { useEffect, useState } from "react";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePushSubscription } from "@/hooks/usePushSubscription";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const NOTIF_KEY = "4go.dismiss.notif";
const INSTALL_KEY = "4go.dismiss.install";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isPreviewHost() {
  // Reserved for detecting editor/sandbox preview environments.
  // No such environment applies to this deployment, so this always returns false.
  return false;
}

export default function InstallAndNotifyPrompt() {
  const { user } = useAuth();
  const { subscribeToPush } = usePushSubscription();
  const [installEvent, setInstallEvent] = useState<BIPEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  // Capture install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BIPEvent);
      if (!localStorage.getItem(INSTALL_KEY) && !isStandalone()) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // iOS hint (no beforeinstallprompt available)
  useEffect(() => {
    if (isStandalone() || localStorage.getItem(INSTALL_KEY)) return;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    if (isIOS) { setIosHint(true); setShowInstall(true); }
  }, []);

  // Notification prompt
  useEffect(() => {
    if (!user) return;
    if (isPreviewHost()) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default" && !localStorage.getItem(NOTIF_KEY)) {
      const t = setTimeout(() => setShowNotif(true), 3000);
      return () => clearTimeout(t);
    }
  }, [user]);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setShowInstall(false);
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_KEY, "1");
    setShowInstall(false);
  };

  const enableNotifications = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") await subscribeToPush();
    } catch { /* ignore */ }
    setShowNotif(false);
  };

  const dismissNotif = () => {
    localStorage.setItem(NOTIF_KEY, "1");
    setShowNotif(false);
  };

  if (!showInstall && !showNotif) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[150] flex flex-col gap-2 pointer-events-none">
      {showNotif && (
        <div className="pointer-events-auto bg-card border border-border rounded-2xl shadow-elevated p-3 flex items-start gap-3 animate-in slide-in-from-bottom-2">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Turn on notifications</p>
            <p className="text-xs text-muted-foreground">Get pinged for calls, messages and friend requests — even when 4GO is closed.</p>
            {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
              <p className="text-[11px] text-muted-foreground mt-1">On iPhone, notifications only work after installing 4GO to your Home Screen.</p>
            )}
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={enableNotifications}>Enable</Button>
              <Button size="sm" variant="ghost" onClick={dismissNotif}>Not now</Button>
            </div>
          </div>
          <button onClick={dismissNotif} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {showInstall && (
        <div className="pointer-events-auto bg-card border border-border rounded-2xl shadow-elevated p-3 flex items-start gap-3 animate-in slide-in-from-bottom-2">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Install 4GO</p>
            {iosHint ? (
              <p className="text-xs text-muted-foreground">Tap the Share icon in Safari, then "Add to Home Screen" for the full app experience.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Install the app for faster access, push notifications and a full-screen experience.</p>
            )}
            {!iosHint && installEvent && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleInstall}>Install</Button>
                <Button size="sm" variant="ghost" onClick={dismissInstall}>Later</Button>
              </div>
            )}
            {iosHint && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={dismissInstall}>Got it</Button>
              </div>
            )}
          </div>
          <button onClick={dismissInstall} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}