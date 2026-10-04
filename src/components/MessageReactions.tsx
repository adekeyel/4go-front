import { useEffect, useState } from "react";
import { listMessageReactions, reactToMessage, removeReaction, type ReactionRow } from "@/api/messages";
import { useSocket } from "@/sockets/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { SmilePlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

interface Props {
  messageId: string;
  isOwn?: boolean;
}

export default function MessageReactions({ messageId, isOwn }: Props) {
  const { user } = useAuth();
  const socket = useSocket();
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    listMessageReactions(messageId)
      .then((data) => { if (mounted) setReactions(data ?? []); })
      .catch(() => undefined);

    // Live updates come from the backend's room socket (reaction:new / reaction:removed).
    const onNew = (r: ReactionRow) => {
      if (!mounted || r.message_id !== messageId) return;
      // One reaction per person: a new emoji from the same user replaces their old one.
      setReactions((prev) => [...prev.filter((x) => x.user_id !== r.user_id), r]);
    };
    const onRemoved = (r: { message_id: string; user_id: string; emoji: string }) => {
      if (!mounted || r.message_id !== messageId) return;
      setReactions((prev) => prev.filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)));
    };
    socket?.on("reaction:new", onNew);
    socket?.on("reaction:removed", onRemoved);

    return () => {
      mounted = false;
      socket?.off("reaction:new", onNew);
      socket?.off("reaction:removed", onRemoved);
    };
  }, [messageId, socket]);

  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, r) => {
      acc[r.emoji] ??= { count: 0, mine: false };
      acc[r.emoji].count += 1;
      if (user && r.user_id === user.id) acc[r.emoji].mine = true;
      return acc;
    },
    {}
  );

  const toggle = async (emoji: string) => {
    if (!user) return;
    setOpen(false);
    const mine = grouped[emoji]?.mine;
    try {
      if (mine) {
        await removeReaction(messageId, emoji);
        setReactions((prev) => prev.filter((x) => !(x.user_id === user.id && x.emoji === emoji)));
      } else {
        const created = await reactToMessage(messageId, emoji);
        setReactions((prev) => [...prev.filter((x) => x.user_id !== user.id), created]);
      }
    } catch {
      // leave the list as is; the socket will correct it if the server state changed
    }
  };

  const entries = Object.entries(grouped);

  return (
    <div className={`flex items-center gap-1 mt-1 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, info]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] border transition-colors ${
            info.mine
              ? "bg-primary/15 border-primary/40 text-foreground"
              : "bg-background border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          <span>{emoji}</span>
          <span className="tabular-nums">{info.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Add reaction"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" side="top">
          <div className="flex items-center gap-0.5">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggle(emoji)}
                className={`text-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-transform hover:scale-110 ${
                  grouped[emoji]?.mine ? "bg-primary/15" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
