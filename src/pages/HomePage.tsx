import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";

import BottomNav from "@/components/BottomNav";
import PageFooter from "@/components/PageFooter";
import RoomCard from "@/components/RoomCard";
import FeedSection from "@/components/feed/FeedSection";
import { MessageCircle, Menu, Info, FileText, LifeBuoy, ChevronRight, Trophy, CalendarCheck, UserPlus, Users, Share2, Camera, Crown, Compass, Flame, Wallet } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useUnreadCalls } from "@/hooks/useUnreadCalls";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PromoBanner from "@/components/PromoBanner";
import SponsorFooterBanner from "@/components/monetization/SponsorFooterBanner";
import SponsorGateDialog from "@/components/monetization/SponsorGateDialog";
import HomeStatusStrip from "@/components/HomeStatusStrip";
import AdSlot from "@/components/ads/AdSlot";
import { shouldShowRoomGate, shouldShowMenuAd, triggerVignetteAd } from "@/lib/sponsor";
import { usePremium } from "@/hooks/usePremium";
import WelcomeTourModal from "@/components/onboarding/WelcomeTourModal";
import GettingStartedChecklist from "@/components/onboarding/GettingStartedChecklist";

interface RoomWithCount {
  id: string;
  name: string;
  description: string | null;
  type: string;
  avatar_url: string | null;
  member_count: number;
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const { isPremium } = usePremium();
  const { unreadCounts, totalUnread, totalUnreadPersistent } = useNotificationContext();
  const { totalUnreadCalls } = useUnreadCalls();
  const dmUnread = Math.max(totalUnread, totalUnreadPersistent) + totalUnreadCalls;
  const [rooms, setRooms] = useState<RoomWithCount[]>([]);
  const [myRooms, setMyRooms] = useState<RoomWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, [user]);

  const fetchRooms = async () => {
    const [roomsResult, userMembershipsResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("type", "public")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      user
        ? supabase.from("room_members").select("room_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] as { room_id: string }[] }),
    ]);

    const allRooms = roomsResult.data || [];
    const roomIds = allRooms.map((r) => r.id);

    const { data: counts } = roomIds.length > 0
      ? await supabase.rpc("get_room_member_counts", { p_room_ids: roomIds })
      : { data: [] };

    const memberCounts: Record<string, number> = {};
    (counts || []).forEach((c: { room_id: string; member_count: number }) => {
      memberCounts[c.room_id] = c.member_count;
    });

    const enriched = allRooms.map((r) => ({
      ...r,
      member_count: memberCounts[r.id] || 0,
    }));

    enriched.sort((a, b) => b.member_count - a.member_count);

    setRooms(enriched);

    const userRoomIds = (userMembershipsResult.data || []).map((m) => m.room_id);
    setMyRooms(enriched.filter((r) => userRoomIds.includes(r.id)));

    setLoading(false);
  };

  const isNewUser = myRooms.length === 0;
  const displayedRooms = isNewUser ? rooms.slice(0, 4) : myRooms.slice(0, 4);

  const handleShare = async () => {
    const referralCode = profile?.referral_code;
    const shareText = referralCode
      ? `Join me on 4GO! Use my referral code: ${referralCode}\nhttps://4go.com.ng`
      : `Join me on 4GO!\nhttps://4go.com.ng`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Join 4GO", text: shareText });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
    }
  };

  const openRoom = (roomId: string) => {
    if (!isPremium && shouldShowRoomGate()) {
      setPendingRoomId(roomId);
      return;
    }
    navigate(`/room/${roomId}`);
  };

  const handleMenuOpen = (open: boolean) => {
    if (open && !isPremium && shouldShowMenuAd()) triggerVignetteAd();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="gradient-hero px-5 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-primary-foreground" />
            <h1 className="text-2xl font-display font-bold text-primary-foreground">4go</h1>
          </div>
          <div className="flex items-center gap-2">
            <Sheet onOpenChange={handleMenuOpen}>
              <SheetTrigger asChild>
                <button className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Menu className="w-5 h-5 text-primary-foreground" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="px-4 pt-6 pb-4 border-b border-border">
                  <SheetTitle className="text-left font-display">4GO</SheetTitle>
                </SheetHeader>
                <nav className="p-3 space-y-1">
                  {[
                    { icon: Camera, label: "Status", path: "/status" },
                    { icon: Crown, label: "4GO Premium", path: "/premium" },
                    { icon: CalendarCheck, label: "Daily Activity", path: "/daily-activity" },
                    { icon: Trophy, label: "Contests & Events", path: "/contests" },
                    { icon: Info, label: "About 4GO", path: "/about" },
                    { icon: FileText, label: "Privacy Policy", path: "/privacy" },
                    { icon: LifeBuoy, label: "Support / Help", path: "/support" },
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
                </nav>
                <AdSlot placement="menu" className="px-3 pb-4" />
              </SheetContent>
            </Sheet>
            <button
              onClick={() => navigate(user ? "/dms" : "/login")}
              className="relative w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center"
              aria-label="Direct messages"
            >
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
              {dmUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {dmUnread > 99 ? "99+" : dmUnread}
                </span>
              )}
            </button>
            <NotificationBell />
          </div>
        </div>
        <p className="text-primary-foreground/80 text-sm">
          {user
            ? `Hey ${profile?.display_name || "there"} 👋 What do you want to do today?`
            : "Nigeria's social platform — chat in Rooms, share on the Feed, and earn coins 👋"}
        </p>
        <HomeStatusStrip />
      </div>

      <AdSlot placement="home" position="top" />

      {!user && (
        <div className="px-4 mt-4">
          <div className="mb-3"><PromoBanner /></div>
          <Card className="shadow-elevated border-0 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-display font-bold text-foreground">Join 4GO</p>
                <p className="text-xs text-muted-foreground">Sign in to chat, post, earn coins & more.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => navigate("/login")}>Login</Button>
                <Button size="sm" onClick={() => navigate("/signup")}>Sign up</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="px-4 -mt-3 space-y-5">
        {/* ── QUICK ACTIONS: at-a-glance map of what the app does ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Compass, label: "Rooms", path: "/discover" },
            { icon: Flame, label: "Feed", path: "/feed" },
            { icon: MessageCircle, label: "DMs", path: user ? "/dms" : "/login" },
            { icon: Wallet, label: "Wallet", path: user ? "/wallet" : "/login" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-card shadow-elevated border-0 py-3 hover:bg-muted/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <action.icon className="w-[18px] h-[18px] text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">{action.label}</span>
            </button>
          ))}
        </div>

        {user && <GettingStartedChecklist hasJoinedRoom={myRooms.length > 0} />}

        {/* ── CONNECT CARD ── */}
        <Card className="shadow-elevated border-0 overflow-hidden">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-base font-display">Connect with people</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Grow your network and have more fun</p>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-2 space-y-2">
            {[
              {
                icon: UserPlus,
                title: "Add Friends",
                subtitle: "Find and add friends",
                primary: true,
                path: user ? "/add-friend" : "/login",
              },
              {
                icon: Users,
                title: "People You May Know",
                subtitle: "Discover people you may know",
                primary: false,
                path: "/discover",
              },
              {
                icon: Share2,
                title: "Invite Your Contacts",
                subtitle: "Invite contacts and get connected",
                primary: false,
                path: user ? "/invite-contacts" : "/login",
              },
            ].map((row) => (
              <button
                key={row.title}
                onClick={() => navigate(row.path)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-colors text-left ${
                  row.primary ? "bg-primary/10 hover:bg-primary/15" : "bg-muted/40 hover:bg-muted"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    row.primary ? "bg-primary text-primary-foreground" : "bg-background text-foreground/70"
                  }`}
                >
                  <row.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${row.primary ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                    {row.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{row.subtitle}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* ── ROOMS SECTION ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-bold text-foreground">
              {isNewUser ? "🔥 Trending Rooms" : "Your Active Rooms"}
            </h2>
            <button
              onClick={() => navigate("/discover")}
              className="text-sm text-primary font-semibold hover:underline"
            >
              See all →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : displayedRooms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-3">
                {isNewUser ? "No rooms yet. Be the first!" : "You haven't joined any rooms yet."}
              </p>
              <button
                onClick={() => navigate(isNewUser ? "/create-room" : "/discover")}
                className="text-primary font-semibold hover:underline"
              >
                {isNewUser ? "Create a Room" : "Discover Rooms"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => openRoom(room.id)}
                  unreadCount={unreadCounts[room.id] || 0}
                />
              ))}
            </div>
          )}
        </section>

        {user && (
          <PromoBanner />
        )}

        {/* ── COMMUNITY PREVIEW ── */}
        <AdSlot placement="home" position="middle" />
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-bold text-foreground">
              From the Community
            </h2>
            <button
              onClick={() => navigate("/feed")}
              className="text-sm text-primary font-semibold hover:underline"
            >
              See more →
            </button>
          </div>
          <FeedSection preview />
        </section>
      </div>

      <SponsorFooterBanner />
      <AdSlot placement="home" position="bottom" />
      <PageFooter />
      <SponsorGateDialog
        open={!!pendingRoomId}
        title="Continue to room?"
        description="Please visit our sponsor in a new tab, then we'll open the room for you."
        continueLabel="Continue"
        onContinue={() => {
          const id = pendingRoomId;
          setPendingRoomId(null);
          if (id) navigate(`/room/${id}`);
        }}
        onCancel={() => setPendingRoomId(null)}
      />
      {user && <WelcomeTourModal />}
      <BottomNav />
    </div>
  );
}
