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
import { UserPlus, MoreVertical, MessageCircle, Search, Plus, Check, CheckCheck, PhoneMissed, BellOff, Pin, Archive, ChevronDown, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ChatActionsSheet from "@/components/ChatActionsSheet";
import CallsList from "@/components/CallsList";
import { useCallContext } from "@/contexts/CallContext";
import { canMakeVoiceCall, canMakeVideoCall } from "@/lib/callPermissions";
import { apiErrorMessage } from "@/lib/apiClient";
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
  pinnedAt: string | null;
  mutedUntil: string | null;
  archived: boolean;
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
  const { user, profile } = useAuth();
  const callCtx = useCallContext();
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
  const { unreadCallsByRoom, totalUnreadCalls, markCallsSeen } = useUnreadCalls();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"messages" | "calls" | "requests">("messages");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [actionsFor, setActionsFor] = useState<Friend | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

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
    socket?.on("chat:prefs", refreshSoon);
    socket?.io.on("reconnect", refreshSoon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      socket?.off("message:notify", refreshSoon);
      socket?.off("message:revoked", refreshSoon);
      socket?.off("message:hidden", refreshSoon);
      socket?.off("call:updated", refreshSoon);
      socket?.off("chat:prefs", refreshSoon);
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
      // (The server already drops messages/calls older than "Clear chat"; the call is double-checked here.)
      const clearedAt = sum?.cleared_at ? new Date(sum.cleared_at).getTime() : 0;
      const rawCall = sum?.last_call ?? null;
      const call = rawCall && new Date(rawCall.created_at).getTime() > clearedAt ? rawCall : null;
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
        pinnedAt: sum?.pinned_at ?? null,
        mutedUntil: sum?.muted_until ?? null,
        archived: sum?.archived ?? false,
      };
    });

    rows.sort((a, b) => {
      // Pinned chats stay on top (in the order they were pinned), everything else by latest activity.
      if (a.pinnedAt && b.pinnedAt) return new Date(a.pinnedAt).getTime() - new Date(b.pinnedAt).getTime();
      if (a.pinnedAt) return -1;
      if (b.pinnedAt) return 1;
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    setFriends(rows);
    setLoading(false);
  };

  const isMuted = (f: Friend) => !!f.mutedUntil && new Date(f.mutedUntil).getTime() > Date.now();

  // Optimistic: update the row now, then confirm with the server (and put it back if it refuses).
  const patchPrefs = async (f: Friend, patch: { pinned?: boolean; archived?: boolean; muted?: roomsApi.MuteChoice }, done?: string) => {
    if (!f.roomId) return;
    const before = friends;
    setFriends((cur) => cur.map((x) => x.friendId !== f.friendId ? x : {
      ...x,
      pinnedAt: patch.pinned === undefined ? (patch.archived ? null : x.pinnedAt) : patch.pinned ? new Date().toISOString() : null,
      archived: patch.archived ?? x.archived,
      mutedUntil: patch.muted === undefined ? x.mutedUntil : patch.muted === "off" ? null : new Date(Date.now() + (patch.muted === "8h" ? 8 * 3600e3 : patch.muted === "1w" ? 7 * 86400e3 : 3e12)).toISOString(),
    }));
    try {
      await roomsApi.updateChatPrefs(f.roomId, patch);
      if (done) toast.success(done);
      void fetchFriends();
    } catch (err) {
      setFriends(before);
      toast.error(apiErrorMessage(err, "Couldn't update this chat"));
    }
  };

  const clearChatFor = async (f: Friend) => {
    if (!f.roomId) return;
    try {
      await roomsApi.clearChat(f.roomId);
      toast.success("Chat cleared");
      void fetchFriends();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't clear this chat"));
    }
  };

  // Long-press (touch) or right-click opens the chat's menu; a normal tap still opens the chat.
  const rowHandlers = (f: Friend) => ({
    onTouchStart: () => {
      if (!f.roomId) return;
      longPressFired.current = false;
      longPressTimer.current = window.setTimeout(() => { longPressFired.current = true; navigator.vibrate?.(10); setActionsFor(f); }, 500);
    },
    onTouchMove: () => { if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; } },
    onTouchEnd: () => { if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; } },
    onContextMenu: (e: React.MouseEvent) => { if (!f.roomId) return; e.preventDefault(); setActionsFor(f); },
    onClick: () => {
      if (longPressFired.current) { longPressFired.current = false; return; }
      void startDM(f.friendId);
    },
  });

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

  const archivedFriends = useMemo(() => friends.filter((f) => f.archived), [friends]);
  const archivedUnread = archivedFriends.reduce((n, f) => n + ((f.roomId ? unreadCounts[f.roomId] : 0) || f.unread || 0), 0);

  useEffect(() => { if (showArchived && archivedFriends.length === 0) setShowArchived(false); }, [showArchived, archivedFriends.length]);

  const filteredFriends = useMemo(() => {
    // Normal view: archived chats are tucked away behind the "Archived" row. Searching looks through everything.
    const base = search.trim() ? friends : showArchived ? archivedFriends : friends.filter((f) => !f.archived);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (f) =>
        (f.profile.display_name || "").toLowerCase().includes(q) ||
        (f.profile.username || "").toLowerCase().includes(q) ||
        (f.lastMessage || "").toLowerCase().includes(q)
    );
  }, [friends, search, showArchived, archivedFriends]);

  // Top "stories-style" friend row: first tile is Add, then friends
  const topRowFriends = friends.slice(0, 12);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TickerBanner />
      <AdBanner />
      <div className="px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          {showArchived ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowArchived(false)} className="w-10 h-10 -ml-2 rounded-full hover:bg-muted flex items-center justify-center" aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
              <h1 className="text-2xl font-display font-bold text-foreground">Archived</h1>
            </div>
          ) : (
            <h1 className="text-2xl font-display font-bold text-foreground">DMs</h1>
          )}
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
        <div className={`relative mb-4 ${tab === "calls" ? "hidden" : ""}`}>
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
        {friends.length > 0 && tab === "messages" && !showArchived && !search.trim() && (
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
        <div className={`${showArchived ? "hidden" : "flex"} items-center gap-6 border-b border-border mb-3`}>
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
            onClick={() => setTab("calls")}
            className={`pb-2.5 text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
              tab === "calls" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Calls
            {totalUnreadCalls > 0 && tab !== "calls" && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {totalUnreadCalls > 99 ? "99+" : totalUnreadCalls}
              </span>
            )}
            {tab === "calls" && (
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

        {/* "Archived" row, like WhatsApp: tucked-away chats live behind it */}
        {!loading && tab === "messages" && !showArchived && !search.trim() && archivedFriends.length > 0 && (
          <button onClick={() => setShowArchived(true)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 text-left transition-colors mb-1">
            <span className="w-12 h-12 flex items-center justify-center"><Archive className="w-5 h-5 text-primary" /></span>
            <span className="flex-1 text-sm font-semibold text-foreground">Archived</span>
            <span className={`text-xs ${archivedUnread > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{archivedUnread > 0 ? `${archivedUnread} unread` : archivedFriends.length}</span>
          </button>
        )}

        {/* Friends list (or the call history when the Calls tab is open) */}
        {tab === "calls" ? (
          <CallsList onSeen={() => void markCallsSeen()} />
        ) : loading ? (
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
              {search.trim() ? `No matches for "${search}"` : "No chats here"}
            </p>
          )
        ) : (
          <div className="space-y-1">
            {filteredFriends.map((f) => {
              const unread =
                (f.roomId ? unreadCounts[f.roomId] : 0) || dmUnreads[f.friendId] || f.unread || 0;
              const missedCalls = f.roomId ? unreadCallsByRoom[f.roomId] || 0 : 0;
              const totalBadgeCount = unread + missedCalls;
              const muted = isMuted(f);
              const pinned = !!f.pinnedAt;
              return (
                <div key={f.friendId} className="relative group">
                <button
                  {...rowHandlers(f)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 text-left transition-colors select-none [-webkit-touch-callout:none]"
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
                      <div className="ml-2 flex items-center gap-1.5 shrink-0">
                        {muted && <BellOff className="w-3.5 h-3.5 text-muted-foreground" aria-label="Muted" />}
                        {totalBadgeCount > 0 ? (
                          <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${muted ? "bg-muted-foreground/60 text-background" : "bg-primary text-primary-foreground"}`}>
                            {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
                          </span>
                        ) : (
                          pinned && <Pin className="w-3.5 h-3.5 text-muted-foreground rotate-45" aria-label="Pinned" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                {f.roomId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionsFor(f); }}
                    aria-label="Chat options"
                    className="absolute right-2 bottom-2 hidden sm:flex w-6 h-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {actionsFor && (
        <ChatActionsSheet
          open
          onOpenChange={(o) => { if (!o) setActionsFor(null); }}
          name={actionsFor.profile.display_name || actionsFor.profile.username || "User"}
          avatarUrl={actionsFor.profile.avatar_url}
          pinned={!!actionsFor.pinnedAt}
          muted={isMuted(actionsFor)}
          archived={actionsFor.archived}
          onPin={() => void patchPrefs(actionsFor, { pinned: !actionsFor.pinnedAt }, actionsFor.pinnedAt ? "Chat unpinned" : "Chat pinned")}
          onMute={(choice) => void patchPrefs(actionsFor, { muted: choice }, choice === "off" ? "Notifications on" : "Chat muted")}
          onArchive={() => void patchPrefs(actionsFor, { archived: !actionsFor.archived }, actionsFor.archived ? "Chat unarchived" : "Chat archived")}
          onClear={() => void clearChatFor(actionsFor)}
          onVoiceCall={actionsFor.roomId && canMakeVoiceCall(profile?.rank) ? () => void callCtx.startCall(actionsFor.roomId!, actionsFor.friendId, actionsFor.profile.display_name || actionsFor.profile.username || "User", "voice", actionsFor.profile.avatar_url) : undefined}
          onVideoCall={actionsFor.roomId && canMakeVideoCall(profile?.rank) ? () => void callCtx.startCall(actionsFor.roomId!, actionsFor.friendId, actionsFor.profile.display_name || actionsFor.profile.username || "User", "video", actionsFor.profile.avatar_url) : undefined}
        />
      )}
      <AdSlot placement="dm" />
      <BottomNav />
    </div>
  );
}
