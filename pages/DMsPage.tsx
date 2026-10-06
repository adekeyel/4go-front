import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import * as friendsApi from "@/api/friends";
import * as roomsApi from "@/api/rooms";
import { useSocket } from "@/sockets/SocketContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useUnreadCalls } from "@/hooks/useUnreadCalls";

import BottomNav from "@/components/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import { UserPlus, MoreVertical, MessageCircle, Search, Plus, Check, CheckCheck, PhoneMissed } from "lucide-react";
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

type Tick = "sent" | "delivered" | "read";

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
  /** Ticks to show in front of the preview when the last thing in the chat is a message YOU sent. */
  lastTick?: Tick;
  /** The last thing in the chat is a call you didn't get to answer. */
  lastIsMissedCall?: boolean;
  unread: number;
}

function messagePreview(type: string, content: string | null): string {
  switch (type) {
    case "image": return "📷 Photo";
    case "audio": return "🎤 Voice note";
    case "video": return "🎬 Video";
    case "shared_post":
    case "shared_page_post": return "🔗 Shared a post";
    default: return content || "";
  }
}

function callPreview(call: roomsApi.DmSummary["last_call"] & {}, myId: string): { text: string; missed: boolean } {
  const kind = call.call_type === "video" ? "video" : "voice";
  const outgoing = call.caller_id === myId;
  switch (call.status) {
    case "answered": return { text: `${outgoing ? "Outgoing" : "Incoming"} ${kind} call`, missed: false };
    case "missed": return outgoing ? { text: "No answer", missed: false } : { text: `Missed ${kind} call`, missed: true };
    case "cancelled": return outgoing ? { text: "Cancelled call", missed: false } : { text: `Missed ${kind} call`, missed: true };
    default: return { text: outgoing ? "Call declined" : "Declined call", missed: false };
  }
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
  const socket = useSocket();
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

  // Keep the list live: a new message or call update refreshes it (batched), and so does coming back to the tab.
  useEffect(() => {
    if (!user) return;
    let timer: number | undefined;
    const refreshSoon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void fetchFriends(), 500);
    };
    const onVisible = () => { if (document.visibilityState === "visible") refreshSoon(); };
    socket?.on("message:notify", refreshSoon);
    socket?.on("message:revoked", refreshSoon);
    socket?.on("message:hidden", refreshSoon);
    socket?.on("call:updated", refreshSoon);
    socket?.io.on("reconnect", refreshSoon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      socket?.off("message:notify", refreshSoon);
      socket?.off("message:revoked", refreshSoon);
      socket?.off("message:hidden", refreshSoon);
      socket?.off("call:updated", refreshSoon);
      socket?.io.off("reconnect", refreshSoon);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // fetchFriends is a plain function below that reads the current user; re-subscribing on every render would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user]);

  const fetchPendingCount = async () => {
    if (!user) return;
    const requests = await friendsApi.listFriendRequests().catch(() => []);
    setPendingCount(requests.length);
  };

  const fetchFriends = async () => {
    if (!user) return;
    // Two requests in total, however many friends there are (it used to open every chat and download 50 messages each).
    const [profiles, summaries] = await Promise.all([
      friendsApi.listFriends().catch(() => []),
      roomsApi.getDmSummaries().catch(() => [] as roomsApi.DmSummary[]),
    ]);
    const byPeer = new Map(summaries.map((s) => [s.peer_id, s]));

    const rows: Friend[] = profiles.map((prof) => {
      const sum = byPeer.get(prof.user_id);
      const msg = sum?.last_message ?? null;
      const call = sum?.last_call ?? null;
      let lastMessage: string | null = null;
      let lastMessageTime: string | null = null;
      let lastTick: Tick | undefined;
      let lastIsMissedCall = false;

      const callIsNewer = call && (!msg || new Date(call.created_at).getTime() > new Date(msg.created_at).getTime());
      if (callIsNewer && call) {
        const c = callPreview(call, user.id);
        lastMessage = c.text;
        lastIsMissedCall = c.missed;
        lastMessageTime = call.created_at;
      } else if (msg) {
        lastMessage = msg.deleted_at ? (msg.sender_id === user.id ? "🚫 You deleted this message" : "🚫 This message was deleted") : messagePreview(msg.type, msg.content);
        lastMessageTime = msg.created_at;
        if (msg.sender_id === user.id) {
          const sentAt = new Date(msg.created_at).getTime();
          if (sum?.peer_last_read_at && sentAt <= new Date(sum.peer_last_read_at).getTime()) lastTick = "read";
          else if (sum?.peer_last_delivered_at && sentAt <= new Date(sum.peer_last_delivered_at).getTime()) lastTick = "delivered";
          else lastTick = "sent";
        }
      }

      return {
        friendId: prof.user_id,
        roomId: sum?.room_id,
        profile: { display_name: prof.display_name, username: prof.username, avatar_url: prof.avatar_url, is_online: prof.is_online },
        lastMessage,
        lastMessageTime,
        lastTick,
        lastIsMissedCall,
        unread: sum?.unread ?? 0,
      };
    });

    rows.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    setFriends(rows);
    setLoading(false);
  };

  const startDM = async (friendId: string) => {
    if (!user) return;
    clearDmUnread(friendId);
    const known = friends.find((f) => f.friendId === friendId)?.roomId;
    if (known) { navigate(`/room/${known}`); return; }
    try {
      const room = await roomsApi.getOrCreateDmRoom(friendId);
      navigate(`/room/${room.id}`);
    } catch {
      toast.error("This private chat isn't available right now");
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (days <= 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return d.toLocaleDateString([], { weekday: "long" });
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
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
                (f.roomId ? unreadCounts[f.roomId] : 0) || dmUnreads[f.friendId] || f.unread || 0;
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
                      <span className={`text-[11px] shrink-0 ml-1 ${unread > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {formatTime(f.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs truncate flex items-center gap-1 ${
                          unread > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {missedCalls > 0 ? (
                          <>
                            <PhoneMissed className="w-3.5 h-3.5 shrink-0 text-destructive" />
                            <span className="text-destructive">{`${missedCalls} missed call${missedCalls > 1 ? "s" : ""}`}</span>
                          </>
                        ) : (
                          <>
                            {f.lastTick === "read" && <CheckCheck className="w-3.5 h-3.5 shrink-0 text-sky-500" />}
                            {f.lastTick === "delivered" && <CheckCheck className="w-3.5 h-3.5 shrink-0" />}
                            {f.lastTick === "sent" && <Check className="w-3.5 h-3.5 shrink-0" />}
                            {f.lastIsMissedCall && <PhoneMissed className="w-3.5 h-3.5 shrink-0 text-destructive" />}
                            <span className={`truncate ${f.lastIsMissedCall ? "text-destructive" : ""}`}>
                              {f.lastMessage || (f.profile.is_online ? "Online" : "Tap to chat")}
                            </span>
                          </>
                        )}
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
