import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import UserAvatar from "@/components/UserAvatar";
import * as roomsApi from "@/api/rooms";
import * as friendsApi from "@/api/friends";
import * as messagesApi from "@/api/messages";

const MAX_TARGETS = 5; // same cap WhatsApp uses
const ANNOUNCEMENTS_ROOM = "📢 4GO Announcements";
const FORWARDABLE = ["text", "image", "video", "audio"];

export function isForwardable(message: { type: string; deleted_at?: string | null }) {
  return !message.deleted_at && FORWARDABLE.includes(message.type);
}

interface ForwardMessage {
  id: string;
  type: string;
  content: string | null;
  media_url: string | null;
  duration: number | null;
}

interface Target {
  key: string; // "dm:<userId>" | "room:<roomId>"
  kind: "dm" | "room";
  name: string;
  avatarUrl?: string | null;
  userId?: string;
  roomId?: string; // known room (DMs without a chat yet get one created on send)
  subtitle: string;
}

interface ForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ForwardMessage | null;
}

export default function ForwardDialog({ open, onOpenChange, message }: ForwardDialogProps) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setQuery("");
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [friends, summaries, rooms] = await Promise.all([
        friendsApi.listFriends().catch(() => []),
        roomsApi.getDmSummaries().catch(() => [] as roomsApi.DmSummary[]),
        roomsApi.listMyRooms().catch(() => [] as roomsApi.Room[]),
      ]);
      if (cancelled) return;
      const roomByPeer = new Map(summaries.map((s) => [s.peer_id, s.room_id]));
      const dmTargets: Target[] = friends.map((f) => ({
        key: `dm:${f.user_id}`,
        kind: "dm",
        name: f.display_name || f.username || "User",
        avatarUrl: f.avatar_url,
        userId: f.user_id,
        roomId: roomByPeer.get(f.user_id),
        subtitle: f.username ? `@${f.username}` : "Friend",
      }));
      const roomTargets: Target[] = rooms
        .filter((r) => r.type !== "dm" && r.name !== ANNOUNCEMENTS_ROOM)
        .map((r) => ({ key: `room:${r.id}`, kind: "room", name: r.name, roomId: r.id, subtitle: "Group" }));
      setTargets([...dmTargets, ...roomTargets].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? targets.filter((t) => t.name.toLowerCase().includes(q)) : targets;
  }, [targets, query]);

  const toggle = (key: string) =>
    setSelected((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length >= MAX_TARGETS) { toast.info(`You can forward to up to ${MAX_TARGETS} chats at once`); return cur; }
      return [...cur, key];
    });

  const send = async () => {
    if (!message || !selected.length || sending) return;
    setSending(true);
    let ok = 0;
    for (const key of selected) {
      const t = targets.find((x) => x.key === key);
      if (!t) continue;
      try {
        const roomId = t.roomId ?? (t.userId ? (await roomsApi.getOrCreateDmRoom(t.userId)).id : undefined);
        if (!roomId) throw new Error("no room");
        await messagesApi.sendMessage(roomId, {
          type: message.type as messagesApi.Message["type"],
          content: message.content ?? undefined,
          media_url: message.media_url ?? undefined,
          duration: message.duration ?? undefined,
          forwarded: true,
        });
        ok += 1;
      } catch {
        toast.error(`Couldn't forward to ${t.name}`);
      }
    }
    setSending(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "Message forwarded" : `Forwarded to ${ok} chats`);
      onOpenChange(false);
    }
  };

  const preview = !message ? "" : message.type === "image" ? "📷 Photo" : message.type === "video" ? "🎬 Video" : message.type === "audio" ? "🎤 Voice note" : message.content || "";

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Forward to…</DialogTitle>
          <DialogDescription className="truncate">{preview}</DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center"><span className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{targets.length ? "No chats match your search" : "No chats to forward to yet"}</p>
          ) : (
            visible.map((t) => {
              const on = selected.includes(t.key);
              return (
                <button key={t.key} onClick={() => toggle(t.key)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 active:bg-muted">
                  <UserAvatar name={t.name} url={t.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.subtitle}</p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                    {on && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground truncate">
            {selected.length ? targets.filter((t) => selected.includes(t.key)).map((t) => t.name).join(", ") : "Select who to send it to"}
          </p>
          <button
            onClick={() => void send()}
            disabled={!selected.length || sending}
            className="shrink-0 rounded-full gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
