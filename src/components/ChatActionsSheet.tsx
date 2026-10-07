import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Bell, BellOff, Eraser, Phone, Pin, PinOff, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserAvatar from "@/components/UserAvatar";
import type { MuteChoice } from "@/api/rooms";

interface ChatActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  avatarUrl?: string | null;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  onPin: () => void;
  onMute: (choice: MuteChoice) => void;
  onArchive: () => void;
  onClear: () => void;
  /** A room (not a 1:1 chat): changes the wording of "Clear chat". */
  isGroup?: boolean;
  /** Only passed for people you're allowed to call. */
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
}

/** The little menu behind long-press / right-click / the hover chevron on a chat in the list. */
export default function ChatActionsSheet({ open, onOpenChange, name, avatarUrl, pinned, muted, archived, onPin, onMute, onArchive, onClear, isGroup, onVoiceCall, onVideoCall }: ChatActionsSheetProps) {
  const [stage, setStage] = useState<"main" | "mute" | "clear">("main");
  useEffect(() => { if (open) setStage("main"); }, [open]);

  const run = (fn: () => void) => { onOpenChange(false); fn(); };
  const row = "w-full flex items-center gap-3 px-5 py-3 text-left text-[15px] text-foreground hover:bg-muted/60 active:bg-muted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 px-5 py-4 border-b border-border">
          <UserAvatar name={name} url={avatarUrl} size="md" />
          <div className="min-w-0 text-left">
            <DialogTitle className="text-base truncate">{name}</DialogTitle>
            <DialogDescription className="sr-only">Chat options</DialogDescription>
          </div>
        </DialogHeader>

        {stage === "main" && (
          <div className="py-1">
            {onVoiceCall && <button className={row} onClick={() => run(onVoiceCall)}><Phone className="w-5 h-5 text-muted-foreground" />Voice call</button>}
            {onVideoCall && <button className={row} onClick={() => run(onVideoCall)}><Video className="w-5 h-5 text-muted-foreground" />Video call</button>}
            <button className={row} onClick={() => run(onPin)}>
              {pinned ? <PinOff className="w-5 h-5 text-muted-foreground" /> : <Pin className="w-5 h-5 text-muted-foreground" />}
              {pinned ? "Unpin chat" : "Pin chat"}
            </button>
            {muted ? (
              <button className={row} onClick={() => run(() => onMute("off"))}><Bell className="w-5 h-5 text-muted-foreground" />Unmute notifications</button>
            ) : (
              <button className={row} onClick={() => setStage("mute")}><BellOff className="w-5 h-5 text-muted-foreground" />Mute notifications</button>
            )}
            <button className={row} onClick={() => run(onArchive)}>
              {archived ? <ArchiveRestore className="w-5 h-5 text-muted-foreground" /> : <Archive className="w-5 h-5 text-muted-foreground" />}
              {archived ? "Unarchive chat" : "Archive chat"}
            </button>
            <button className={`${row} !text-destructive`} onClick={() => setStage("clear")}><Eraser className="w-5 h-5" />Clear chat</button>
          </div>
        )}

        {stage === "mute" && (
          <div className="py-1">
            <p className="px-5 pt-2 pb-1 text-xs text-muted-foreground">You'll still get the messages, just without sound or notifications. Calls still ring.</p>
            {([["8h", "8 hours"], ["1w", "1 week"], ["forever", "Always"]] as [MuteChoice, string][]).map(([value, label]) => (
              <button key={value} className={row} onClick={() => run(() => onMute(value))}>{label}</button>
            ))}
            <button className={`${row} text-muted-foreground`} onClick={() => setStage("main")}>Back</button>
          </div>
        )}

        {stage === "clear" && (
          <div className="py-1">
            <p className="px-5 pt-2 pb-2 text-sm text-foreground">
              {isGroup ? "Clear all messages in this room? This only clears it for you. Other members aren't affected." : `Clear all messages and calls in this chat? This only clears it for you. ${name} keeps their copy.`}
            </p>
            <button className={`${row} !text-destructive font-semibold`} onClick={() => run(onClear)}>Clear chat</button>
            <button className={row} onClick={() => setStage("main")}>Cancel</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
