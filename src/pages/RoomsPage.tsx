import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Archive, ArrowLeft, BellOff, ChevronDown, Lock, Pin, Plus, Search } from "lucide-react";
import * as roomsApi from "@/api/rooms";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useSocket } from "@/sockets/SocketContext";
import { usePremium } from "@/hooks/usePremium";
import { shouldShowRoomGate } from "@/lib/sponsor";
import { sortChats } from "@/lib/roomOrder";
import { formatChatTime } from "@/lib/chatTime";
import BottomNav from "@/components/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import ChatActionsSheet from "@/components/ChatActionsSheet";
import SponsorGateDialog from "@/components/monetization/SponsorGateDialog";
import { Skeleton } from "@/components/ui/skeleton";

type RoomRow = roomsApi.MyRoomSummary;

function errorMessage(err: unknown, fallback: string) {
  return (axios.isAxiosError(err) && (err.response?.data as { error?: string })?.error) || fallback;
}

function previewOf(m: NonNullable<RoomRow["last_message"]>): string {
  if (m.deleted_at) return m.sender_name === "You" ? "🚫 You deleted this message" : "🚫 This message was deleted";
  if (m.type === "system") return m.content || "";
  const body =
    m.type === "image" ? "📷 Photo" :
    m.type === "video" ? "🎬 Video" :
    m.type === "audio" ? "🎤 Voice note" :
    m.type === "shared_post" || m.type === "shared_page_post" ? "Shared a post" :
    m.content || "";
  return `${m.sender_name}: ${body}`;
}

export default function RoomsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const { isPremium } = usePremium();
  const { unreadCounts } = useNotificationContext();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [actionsFor, setActionsFor] = useState<RoomRow | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const fetchRooms = useCallback(async () => {
    try {
      setRooms(await roomsApi.listMyRoomsDetailed());
    } catch {
      toast.error("Couldn't load your rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) void fetchRooms(); }, [user, fetchRooms]);

  // New message / message deleted / settings changed on another device: refresh (batched).
  useEffect(() => {
    if (!socket) return;
    let timer: number | null = null;
    const refreshSoon = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void fetchRooms(), 400);
    };
    const events = ["message:notify", "message:revoked", "message:hidden", "chat:prefs", "chat:cleared"];
    events.forEach((e) => socket.on(e, refreshSoon));
    return () => { events.forEach((e) => socket.off(e, refreshSoon)); if (timer) window.clearTimeout(timer); };
  }, [socket, fetchRooms]);

  const isMuted = (r: RoomRow) => !!r.muted_until && new Date(r.muted_until).getTime() > Date.now();

  const archivedRooms = useMemo(() => rooms.filter((r) => r.archived), [rooms]);
  const archivedUnread = archivedRooms.reduce((n, r) => n + (unreadCounts[r.id] || 0), 0);

  useEffect(() => { if (showArchived && archivedRooms.length === 0) setShowArchived(false); }, [showArchived, archivedRooms.length]);

  const visible = useMemo(() => {
    // Archived rooms are tucked behind the "Archived" row; searching looks through everything.
    const base = search.trim() ? rooms : showArchived ? archivedRooms : rooms.filter((r) => !r.archived);
    const q = search.trim().toLowerCase();
    const filtered = q ? base.filter((r) => r.name.toLowerCase().includes(q)) : base;
    return sortChats(filtered.map((r) => ({ ...r, last_message: r.last_message }))) as RoomRow[];
  }, [rooms, search, showArchived, archivedRooms]);

  // Optimistic: update the row now, confirm with the server, and put it back if the server refuses (e.g. pin limit).
  const patchPrefs = async (r: RoomRow, patch: { pinned?: boolean; archived?: boolean; muted?: roomsApi.MuteChoice }, done?: string) => {
    const before = rooms;
    setRooms((cur) => cur.map((x) => x.id !== r.id ? x : {
      ...x,
      pinned_at: patch.pinned === undefined ? (patch.archived ? null : x.pinned_at) : patch.pinned ? new Date().toISOString() : null,
      archived: patch.archived ?? x.archived,
      muted_until: patch.muted === undefined ? x.muted_until : patch.muted === "off" ? null : new Date(Date.now() + (patch.muted === "8h" ? 8 * 3600e3 : patch.muted === "1w" ? 7 * 86400e3 : 3e12)).toISOString(),
    }));
    try {
      await roomsApi.updateChatPrefs(r.id, patch);
      if (done) toast.success(done);
      void fetchRooms();
    } catch (err) {
      setRooms(before);
      toast.error(errorMessage(err, "Couldn't update this room"));
    }
  };

  const clearRoom = async (r: RoomRow) => {
    try {
      await roomsApi.clearChat(r.id);
      toast.success("Room cleared");
      void fetchRooms();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't clear this room"));
    }
  };

  const openRoom = (roomId: string) => {
    if (!isPremium && shouldShowRoomGate()) { setPendingRoomId(roomId); return; }
    navigate(`/room/${roomId}`);
  };

  // Long-press (touch) or right-click opens the room's menu; a normal tap still opens the room.
  const rowHandlers = (r: RoomRow) => ({
    onTouchStart: () => {
      longPressFired.current = false;
      longPressTimer.current = window.setTimeout(() => { longPressFired.current = true; navigator.vibrate?.(10); setActionsFor(r); }, 500);
    },
    onTouchMove: () => { if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; } },
    onTouchEnd: () => { if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; } },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setActionsFor(r); },
    onClick: () => {
      if (longPressFired.current) { longPressFired.current = false; return; }
      openRoom(r.id);
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-12 pb-2">
        <div className="flex items-center justify-between mb-4">
          {showArchived ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowArchived(false)} className="w-10 h-10 -ml-2 rounded-full hover:bg-muted flex items-center justify-center" aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
              <h1 className="text-2xl font-display font-bold text-foreground">Archived rooms</h1>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/")} className="w-10 h-10 -ml-2 rounded-full hover:bg-muted flex items-center justify-center" aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
              <h1 className="text-2xl font-display font-bold text-foreground">Rooms</h1>
            </div>
          )}
          <button onClick={() => navigate("/create-room")} className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-elevated" aria-label="Create a room"><Plus className="w-5 h-5 text-primary-foreground" /></button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your rooms"
            className="w-full h-11 bg-muted rounded-full pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {!loading && !showArchived && !search.trim() && archivedRooms.length > 0 && (
          <button onClick={() => setShowArchived(true)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 text-left transition-colors mb-1">
            <span className="w-12 h-12 flex items-center justify-center"><Archive className="w-5 h-5 text-primary" /></span>
            <span className="flex-1 text-sm font-semibold text-foreground">Archived</span>
            <span className={`text-xs ${archivedUnread > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{archivedUnread > 0 ? `${archivedUnread} unread` : archivedRooms.length}</span>
          </button>
        )}

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-muted-foreground text-sm mb-3">
              {search.trim() ? `No rooms match "${search}"` : rooms.length === 0 ? "You haven't joined any rooms yet." : "No rooms here"}
            </p>
            {rooms.length === 0 && (
              <button onClick={() => navigate("/discover")} className="text-primary font-semibold text-sm hover:underline">Discover rooms</button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {visible.map((r) => {
              const unread = unreadCounts[r.id] || 0;
              const muted = isMuted(r);
              const pinned = !!r.pinned_at;
              return (
                <div key={r.id} className="relative group">
                  <button {...rowHandlers(r)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 text-left transition-colors select-none [-webkit-touch-callout:none]">
                    <UserAvatar name={r.name} url={r.avatar_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`flex items-center gap-1 text-sm truncate ${unread > 0 ? "font-bold" : "font-semibold"} text-foreground`}>
                          <span className="truncate">{r.name}</span>
                          {r.type === "private" && <Lock className="w-3 h-3 shrink-0 text-muted-foreground" aria-label="Private room" />}
                        </p>
                        <span className={`text-[11px] shrink-0 ${unread > 0 && !muted ? "text-primary font-semibold" : "text-muted-foreground"}`}>{formatChatTime(r.last_message?.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-[13px] truncate ${unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {r.last_message ? previewOf(r.last_message) : r.description || `${r.member_count} member${r.member_count === 1 ? "" : "s"}`}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {muted && <BellOff className="w-3.5 h-3.5 text-muted-foreground" aria-label="Muted" />}
                          {unread > 0 ? (
                            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${muted ? "bg-muted-foreground/60 text-background" : "bg-primary text-primary-foreground"}`}>
                              {unread > 99 ? "99+" : unread}
                            </span>
                          ) : (
                            pinned && <Pin className="w-3.5 h-3.5 text-muted-foreground rotate-45" aria-label="Pinned" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionsFor(r); }}
                    aria-label="Room options"
                    className="absolute right-2 bottom-2 hidden sm:flex w-6 h-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
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
          name={actionsFor.name}
          avatarUrl={actionsFor.avatar_url}
          isGroup
          pinned={!!actionsFor.pinned_at}
          muted={isMuted(actionsFor)}
          archived={actionsFor.archived}
          onPin={() => void patchPrefs(actionsFor, { pinned: !actionsFor.pinned_at }, actionsFor.pinned_at ? "Room unpinned" : "Room pinned")}
          onMute={(choice) => void patchPrefs(actionsFor, { muted: choice }, choice === "off" ? "Notifications on" : "Room muted")}
          onArchive={() => void patchPrefs(actionsFor, { archived: !actionsFor.archived }, actionsFor.archived ? "Room unarchived" : "Room archived")}
          onClear={() => void clearRoom(actionsFor)}
        />
      )}

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
      <BottomNav />
    </div>
  );
}
