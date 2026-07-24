import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "4go_cookie_consent_v1";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const persist = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value, at: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="max-w-lg mx-auto rounded-2xl border border-border bg-card/95 backdrop-blur shadow-card p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-display font-bold text-foreground">
                We use cookies
              </h2>
              <button
                onClick={() => persist("declined")}
                className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              4GO uses essential, analytics, and advertising cookies to keep the
              platform secure, improve your experience, and support
              monetization. See our{" "}
              <Link to="/cookies" className="text-primary underline">
                Cookies Policy
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9"
                onClick={() => persist("declined")}
              >
                Decline
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 gradient-primary text-primary-foreground"
                onClick={() => persist("accepted")}
              >
                Accept all
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
