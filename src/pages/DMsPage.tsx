import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useUnreadCalls } from "@/hooks/useUnreadCalls";

import BottomNav from "@/components/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import { UserPlus, MoreVertical, MessageCircle, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import AdBanner from "@/components/AdBanner";
import TickerBanner from "@/components/TickerBanner";
import AdSlot from "@/components/ads/AdSlot";
import { usePremium } from "@/hooks/usePremium";
import { shouldShowDmNavAd, triggerVignetteAd } from "@/lib/sponsor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Friend {
  friendId: string;
  roomId?: string;
  profile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
  };
  lastMessage?: string | null;
  lastMessageTime?: string | null;
}

export default function DMsPage() {
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const premiumRef = useRef(false);
  premiumRef.current = isPremium;

  // Show a vignette ad once every 6 times the user leaves the DMs page.
  useEffect(() => {
    return () => {
      if (!premiumRef.current && shouldShowDmNavAd()) triggerVignetteAd();
    };
  }, []);
  const {
    clearUnreadMessages,
    clearUnreadFriendRequests,
    clearLatestMessageSource,
    dmUnreads,
    clearDmUnread,
    unreadCounts,
  } = useNotificationContext();
  const navigate = useNavigate();
  const { unreadCallsByRoom } = useUnreadCalls();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"messages" | "requests">("messages");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    clearUnreadMessages();
    clearUnreadFriendRequests();
    clearLatestMessageSource();
    fetchFriends();
    fetchPendingCount();
    // Intentionally runs once per user (on mount/login): clears unread badges
    // and loads the friends list + pending count for this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchPendingCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("friends")
      .select("*", { count: "exact", head: true })
      .eq("addressee_id", user.id)
      .eq("status", "pending");
    setPendingCount(count || 0);
  };

  const fetchFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friends")
      .select("*")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (data && data.length > 0) {
      const friendIds = data.map((f) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, is_online")
        .in("user_id", friendIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const friendsWithMessages = await Promise.all(
        friendIds.map(async (id) => {
          const prof =
            profileMap.get(id) ||
            { display_name: null, username: null, avatar_url: null, is_online: null };
          let lastMessage: string | null = null;
          let lastMessageTime: string | null = null;
          let roomId: string | undefined;

          try {
            const { data: roomData } = await supabase.rpc("get_or_create_dm_room", {
              user1_id: user.id,
              user2_id: id,
            });
            if (roomData) {
              roomId = roomData;
              const { data: msgs } = await supabase
                .from("messages")
                .select("content, type, created_at")
                .eq("room_id", roomData)
                .order("created_at", { ascending: false })
                .limit(1);
              if (msgs && msgs.length > 0) {
                const msg = msgs[0];
                lastMessage =
                  msg.type === "image"
                    ? "📷 Photo"
                    : msg.type === "audio"
                    ? "🎤 Voice note"
                    : msg.content;
                lastMessageTime = msg.created_at;
              }
            }
          } catch {
            // blocked / error
          }

          return {
            friendId: id,
            roomId,
            profile: prof,
            lastMessage,
            lastMessageTime,
          };
        })
      );

      friendsWithMessages.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return (
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
      });

      setFriends(friendsWithMessages);
    } else {
      setFriends([]);
    }
    setLoading(false);
  };

  const startDM = async (friendId: string) => {
    if (!user) return;
    clearDmUnread(friendId);
    const { data, error } = await supabase.rpc("get_or_create_dm_room", {
      user1_id: user.id,
      user2_id: friendId,
    });
    if (error) {
      toast.error("This private chat isn't available right now");
      return;
    }
    navigate(`/room/${data}`);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 7 * 86400000) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const filteredFriends = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter(
      (f) =>
        (f.profile.display_name || "").toLowerCase().includes(q) ||
        (f.profile.username || "").toLowerCase().includes(q) ||
        (f.lastMessage || "").toLowerCase().includes(q)
    );
  }, [friends, search]);

  // Top "stories-style" friend row: first tile is Add, then friends
  const topRowFriends = friends.slice(0, 12);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TickerBanner />
      <AdBanner />
      <div className="px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-display font-bold text-foreground">DMs</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/add-friend")}
              className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Add friend"
            >
              <UserPlus className="w-5 h-5 text-foreground" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="More"
                >
                  <MoreVertical className="w-5 h-5 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/friend-requests")}>
                  Friend Requests {pendingCount > 0 && `(${pendingCount})`}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/add-friend")}>
                  Add Friend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/discover")}>
                  Discover People
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Top friends row */}
        {friends.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none mb-4">
            <div className="flex items-start gap-4 pb-1">
              {/* Add tile */}
              <button
                onClick={() => navigate("/add-friend")}
                className="flex flex-col items-center gap-1.5 shrink-0 w-14"
              >
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-[11px] text-muted-foreground">Add</span>
              </button>

              {topRowFriends.map((f) => (
                <button
                  key={`top-${f.friendId}`}
                  onClick={() => startDM(f.friendId)}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-14"
                >
                  <UserAvatar
                    name={f.profile.display_name || f.profile.username}
                    url={f.profile.avatar_url}
                    size="md"
                    online={f.profile.is_online}
                    showOnline
                  />
                  <span className="text-[11px] text-foreground truncate w-full text-center">
                    {(f.profile.display_name || "User").split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-border mb-3">
          <button
            onClick={() => setTab("messages")}
            className={`pb-2.5 text-sm font-semibold transition-colors relative ${
              tab === "messages" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Messages
            {tab === "messages" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => navigate("/friend-requests")}
            className={`pb-2.5 text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
              tab === "requests" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Requests
            {pendingCount > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Friends list */}
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>
        ) : filteredFriends.length === 0 ? (
          friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">No friends yet</p>
              <p className="text-muted-foreground text-xs mt-1">
                Add friends to start chatting!
              </p>
              <button
                onClick={() => navigate("/add-friend")}
                className="mt-4 px-6 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-elevated"
              >
                Add Friends
              </button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-8">
              No matches for "{search}"
            </p>
          )
        ) : (
          <div className="space-y-1">
            {filteredFriends.map((f) => {
              const unread =
                (f.roomId ? unreadCounts[f.roomId] : 0) || dmUnreads[f.friendId] || 0;
              const missedCalls = f.roomId ? unreadCallsByRoom[f.roomId] || 0 : 0;
              const totalBadgeCount = unread + missedCalls;
              return (
                <button
                  key={f.friendId}
                  onClick={() => startDM(f.friendId)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 text-left transition-colors"
                >
                  <UserAvatar
                    name={f.profile.display_name || f.profile.username}
                    url={f.profile.avatar_url}
                    size="lg"
                    online={f.profile.is_online}
                    showOnline
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm text-foreground truncate ${
                          unread > 0 ? "font-bold" : "font-semibold"
                        }`}
                      >
                        {f.profile.display_name || "User"}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                        {formatTime(f.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs truncate ${
                          unread > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {missedCalls > 0
                          ? `📞 ${missedCalls} missed call${missedCalls > 1 ? "s" : ""}`
                          : f.lastMessage || (f.profile.is_online ? "Online" : "Tap to chat")}
                      </p>
                      {totalBadgeCount > 0 && (
                        <span className="ml-2 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                          {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <AdSlot placement="dm" />
      <BottomNav />
    </div>
  );
}
