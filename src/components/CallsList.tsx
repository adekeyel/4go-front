import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import UserAvatar from "@/components/UserAvatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCallContext } from "@/contexts/CallContext";
import { useSocket } from "@/sockets/SocketContext";
import { canMakeVideoCall, canMakeVoiceCall } from "@/lib/callPermissions";
import * as callsApi from "@/api/calls";

type Entry = callsApi.CallHistoryEntry;

/** How a call reads from MY side, e.g. an incoming call that rang out is "Missed", an outgoing one is "No answer". */
function describe(e: Entry): { label: string; missed: boolean; Icon: typeof Phone } {
  if (e.direction === "incoming") {
    if (e.status === "missed" || e.status === "cancelled") return { label: "Missed", missed: true, Icon: PhoneMissed };
    if (e.status === "declined") return { label: "Declined", missed: false, Icon: PhoneOff };
    return { label: "Incoming", missed: false, Icon: PhoneIncoming };
  }
  if (e.status === "missed") return { label: "No answer", missed: false, Icon: PhoneOutgoing };
  if (e.status === "cancelled") return { label: "Cancelled", missed: false, Icon: PhoneOutgoing };
  if (e.status === "declined") return { label: "Declined", missed: false, Icon: PhoneOff };
  return { label: "Outgoing", missed: false, Icon: PhoneOutgoing };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = startOfToday.getTime() - d.getTime();
  if (diff <= 0) return time;
  if (diff <= dayMs) return `Yesterday, ${time}`;
  if (diff <= 6 * dayMs) return `${d.toLocaleDateString([], { weekday: "long" })}, ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

interface Group {
  key: string;
  latest: Entry;
  count: number;
}

/** Back-to-back calls with the same person that ended the same way and were the same kind collapse into one row: "Ada (3)". */
function groupEntries(entries: Entry[]): Group[] {
  const groups: Group[] = [];
  for (const e of entries) {
    const prev = groups[groups.length - 1];
    const same = prev && prev.latest.peer.user_id === e.peer.user_id && prev.latest.call_type === e.call_type && describe(prev.latest).label === describe(e).label;
    if (same) prev.count += 1;
    else groups.push({ key: e.id, latest: e, count: 1 });
  }
  return groups;
}

interface CallsListProps {
  /** Called once the list has been shown, so the missed-call badge can clear. */
  onSeen?: () => void;
}

export default function CallsList({ onSeen }: CallsListProps) {
  const { user, profile } = useAuth();
  const call = useCallContext();
  const socket = useSocket();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      const { calls, hasMore: more } = await callsApi.getCallHistory();
      setEntries(calls);
      setHasMore(more);
    } catch {
      toast.error("Couldn't load your calls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // A call just ended or was missed: refresh (batched so a burst of events is one request).
  useEffect(() => {
    if (!socket) return;
    let timer: number | null = null;
    const refresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 400);
    };
    socket.on("call:updated", refresh);
    return () => { socket.off("call:updated", refresh); if (timer) window.clearTimeout(timer); };
  }, [socket, load]);

  // Having the list on screen counts as having seen the missed calls in it.
  useEffect(() => {
    if (!loading) onSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const loadMore = async () => {
    const oldest = entries[entries.length - 1]?.created_at;
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const { calls, hasMore: more } = await callsApi.getCallHistory(oldest);
      setEntries((cur) => [...cur, ...calls.filter((c) => !cur.some((x) => x.id === c.id))]);
      setHasMore(more);
    } catch {
      toast.error("Couldn't load more calls");
    }
    setLoadingMore(false);
  };

  const clearLog = async () => {
    try {
      await callsApi.clearCallHistory();
      setEntries([]);
      setHasMore(false);
      toast.success("Call log cleared");
    } catch {
      toast.error("Couldn't clear the call log");
    }
  };

  const groups = useMemo(() => groupEntries(entries), [entries]);

  const callBack = (e: Entry) => {
    const name = e.peer.display_name || e.peer.username || "User";
    const allowed = e.call_type === "video" ? canMakeVideoCall(profile?.rank) : canMakeVoiceCall(profile?.rank);
    if (!allowed) {
      toast.error(`Your rank doesn't allow ${e.call_type} calls yet.`);
      return;
    }
    void call.startCall(e.room_id, e.peer.user_id, name, e.call_type, e.peer.avatar_url);
  };

  if (!user) return null;

  if (loading) return <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>;

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3"><Phone className="w-8 h-8 text-muted-foreground" /></div>
        <p className="text-muted-foreground text-sm font-medium">No calls yet</p>
        <p className="text-muted-foreground text-xs mt-1 max-w-[16rem]">Open a chat and tap the phone or video icon to start a call. Your calls will show up here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</h2>
        <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />Clear
        </button>
      </div>

      <div className="space-y-0.5">
        {groups.map(({ key, latest: e, count }) => {
          const { label, missed, Icon } = describe(e);
          const name = e.peer.display_name || e.peer.username || "User";
          const TypeIcon = e.call_type === "video" ? Video : Phone;
          const answered = e.status === "answered" && e.duration_seconds > 0;
          return (
            <div key={key} className="flex items-center gap-1 rounded-xl hover:bg-muted/50">
              <button onClick={() => navigate(`/room/${e.room_id}`)} className="flex items-center gap-3 flex-1 min-w-0 p-2.5 text-left">
                <UserAvatar name={name} url={e.peer.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${missed ? "text-destructive" : "text-foreground"}`}>
                    {name}{count > 1 && <span className="font-normal"> ({count})</span>}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${missed ? "text-destructive" : "text-primary"}`} />
                    <span className="truncate">{label} · {formatWhen(e.created_at)}{answered ? ` · ${formatDuration(e.duration_seconds)}` : ""}</span>
                  </p>
                </div>
              </button>
              <button onClick={() => callBack(e)} aria-label={`${e.call_type === "video" ? "Video" : "Voice"} call ${name}`} className="p-3 mr-1 text-primary rounded-full hover:bg-primary/10 active:scale-95">
                <TypeIcon className="w-5 h-5" />
              </button>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button onClick={() => void loadMore()} disabled={loadingMore} className="mt-3 w-full py-2 text-sm font-medium text-primary disabled:opacity-60">
          {loadingMore ? "Loading…" : "Show older calls"}
        </button>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear call log?</AlertDialogTitle>
            <AlertDialogDescription>This removes your call history from this account. The people you called keep their own records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void clearLog()}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
