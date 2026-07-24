import { Home, Search, Plus, User, Flame } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadMentions } from "@/hooks/useUnreadMentions";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Discover", path: "/discover" },
  { icon: Plus, label: "Create", path: "/create-room" },
  { icon: Flame, label: "Feed", path: "/feed" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { unreadMentions } = useUnreadMentions();
  const requireAuth = (path: string) => (user ? path : "/login");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const publicPaths = new Set(["/", "/discover", "/feed"]);
          const targetPath = publicPaths.has(tab.path) ? tab.path : requireAuth(tab.path);
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(targetPath)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {tab.label === "Create" ? (
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center -mt-4 shadow-elevated">
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {tab.label === "Home" && unreadMentions > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                        {unreadMentions > 9 ? "9+" : unreadMentions}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
