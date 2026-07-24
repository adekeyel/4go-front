import BottomNav from "@/components/BottomNav";
import CreatePostCard from "@/components/feed/CreatePostCard";
import FeedSection from "@/components/feed/FeedSection";
import NotificationBell from "@/components/NotificationBell";
import TickerBanner from "@/components/TickerBanner";
import AdSlot from "@/components/ads/AdSlot";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedKey, setFeedKey] = useState(0);
  const handlePostCreated = useCallback(() => setFeedKey((k) => k + 1), []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TickerBanner />
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} aria-label="Back" className="md:hidden">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">Feed</h1>
          </div>
          <NotificationBell />
        </div>
      </header>

      <div className="px-4 pt-3 space-y-4">
        {user && <CreatePostCard onPostCreated={handlePostCreated} />}
        <FeedSection key={feedKey} />
      </div>

      <AdSlot placement="feed" />
      <BottomNav />
    </div>
  );
}
