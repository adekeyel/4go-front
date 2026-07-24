import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import UserAvatar from "./UserAvatar";

export interface BannerData {
  id: string;
  title: string;
  body: string;
  avatarUrl?: string | null;
  avatarName?: string | null;
  navigateTo?: string;
}

interface InAppBannerProps {
  banner: BannerData | null;
  onDismiss: () => void;
}

export default function InAppBanner({ banner, onDismiss }: InAppBannerProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (banner) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [banner, onDismiss]);

  if (!banner) return null;

  const handleTap = () => {
    if (banner.navigateTo) {
      navigate(banner.navigateTo);
    }
    setVisible(false);
    setTimeout(onDismiss, 100);
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] px-3 pt-[env(safe-area-inset-top,12px)] transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div
        onClick={handleTap}
        className="mt-2 mx-auto max-w-lg flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-elevated cursor-pointer"
      >
        {banner.avatarName && (
          <UserAvatar name={banner.avatarName} url={banner.avatarUrl} size="md" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{banner.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{banner.body}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            setTimeout(onDismiss, 100);
          }}
          className="shrink-0 text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
