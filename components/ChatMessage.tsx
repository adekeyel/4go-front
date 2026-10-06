import { useState, useEffect, useRef } from "react";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { renderRichText } from "@/lib/mentions";
import SharedPostMessage from "@/components/feed/SharedPostMessage";
import SharedPagePostMessage from "@/components/feed/SharedPagePostMessage";
import MessageReactions from "@/components/MessageReactions";
import { Tables } from "@/types/database";
import { recordMessageView, getMessageViewCounts } from "@/api/messages";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Ban, Check, CheckCheck, ChevronDown, Clock, Copy, CornerUpLeft, Eye, Flag, Forward, Gift, Pencil, Pin, ShieldBan, Trash2, X } from "lucide-react";
import { RankBadge } from "./RankBadge";
import UserAvatar from "./UserAvatar";
import UserProfilePreview from "./UserProfilePreview";
import VerifiedBadge from "./VerifiedBadge";
import ProfileBadges from "./ProfileBadges";
import GiftPostDialog from "./GiftPostDialog";
import MediaViewer from "./MediaViewer";
import { isSupportAgent } from "@/lib/supportAgents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { canDeleteForEveryone } from "@/lib/messageRules";
import { isForwardable } from "@/components/ForwardDialog";

type Message = Tables<"messages"> & { edited_at?: string | null; reply_to?: string | null; deleted_at?: string | null; forwarded?: boolean | null };

interface ReplyInfo {
  id: string;
  content: string | null;
  senderName: string;
  senderId?: string;
  type: string;
}

interface ChatMessageProps {
  message: Message & {
    profile?: { display_name: string | null; avatar_url: string | null; username: string | null; rank?: string | null; is_monetized?: boolean };
  };
  isOwn: boolean;
  isAdmin?: boolean;
  roomId?: string;
  onEdit?: (messageId: string, content: string) => Promise<void>;
  /** "me" = hide from my view only; "everyone" = replace with "This message was deleted" for the whole chat. */
  onDelete?: (messageId: string, scope: "me" | "everyone") => Promise<void>;
  onForward?: (message: Message) => void;
  onReport?: (message: Message) => void;
  onBlockUser?: (userId: string, name: string) => void;
  onPin?: (messageId: string) => void;
  onReply?: (message: Message & { profile?: { display_name: string | null } }) => void;
  isPinned?: boolean;
  replyInfo?: ReplyInfo | null;
  onScrollToMessage?: (messageId: string) => void;
  /** WhatsApp-style ticks for the sender's own outgoing messages. */
  status?: "sent" | "delivered" | "read";
  /** Whether this is the first bubble in a run of consecutive messages from the same sender — shows name/avatar. */
  showHeader?: boolean;
  /** Whether this bubble is tucked into a run of consecutive messages from the same sender — tighter spacing. */
  grouped?: boolean;
  /** Set while the message is still being sent from this device ("sending") or couldn't be sent ("failed"). */
  localState?: "sending" | "failed";
  onRetry?: () => void;
  onDiscard?: () => void;
  /** Group rooms show the sender's name inside the bubble; 1:1 chats don't (like WhatsApp). Default true. */
  showSenderName?: boolean;
  /** Group rooms show the sender's avatar beside the first bubble of a run; 1:1 chats don't. Default true. */
  showAvatar?: boolean;
}

// A stable colour per sender so people are easy to tell apart in a group.
const NAME_COLORS = ["#06cf9c", "#53bdeb", "#e26ab6", "#ffa726", "#a98cf5", "#f06c6c", "#7fb83a", "#d4a017"];
function senderColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

const LONG_PRESS_MS = 450;
const SWIPE_REPLY_PX = 56;

export default function ChatMessage({ message, isOwn, isAdmin, roomId, onEdit, onDelete, onForward, onReport, onBlockUser, onPin, onReply, isPinned, replyInfo, onScrollToMessage, status, showHeader = true, grouped = false, localState, onRetry, onDiscard, showSenderName = true, showAvatar = true }: ChatMessageProps) {
  const { user } = useAuth();
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const [saving, setSaving] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ type: "image" | "video"; url: string } | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null; fired: boolean } | null>(null);
  const pressTimer = useRef<number | null>(null);

  const clearPress = () => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; } };
  useEffect(() => clearPress, []);

  // Long-press (touch) opens the message menu; swipe right replies.
  const onTouchStart = (e: React.TouchEvent) => {
    if (localState) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, horizontal: null, fired: false };
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      if (touch.current && !touch.current.fired) {
        touch.current.fired = true;
        navigator.vibrate?.(10);
        setMenuOpen(true);
      }
    }, LONG_PRESS_MS);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const st = touch.current;
    if (!st || st.fired) return;
    const t = e.touches[0];
    const mx = t.clientX - st.x;
    const my = t.clientY - st.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) clearPress();
    if (st.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) st.horizontal = Math.abs(mx) > Math.abs(my) * 1.5;
    if (st.horizontal && mx > 0 && onReply) setDx(Math.min(mx, SWIPE_REPLY_PX + 24));
  };
  const onTouchEnd = () => {
    clearPress();
    const st = touch.current;
    touch.current = null;
    if (st?.horizontal && dx >= SWIPE_REPLY_PX && onReply && !message.deleted_at) {
      navigator.vibrate?.(10);
      onReply(message);
    }
    setDx(0);
  };
  const onContextMenu = (e: React.MouseEvent) => {
    if (localState || isEditing) return;
    e.preventDefault(); // right-click (desktop) / long-press (Android) opens our menu instead of the browser's
    setMenuOpen(true);
  };

  // Gift eligible: monetized user + image/video/long text
  const isGiftEligible = !isOwn && message.profile?.is_monetized && (
    message.type === "image" ||
    message.type === "video" ||
    (message.type === "text" && (message.content?.length || 0) >= 100)
  );

  // View-eligible content (monetized user's photos/videos/long posts)
  const isViewEligible = message.profile?.is_monetized && (
    message.type === "image" ||
    message.type === "video" ||
    (message.type === "text" && (message.content?.length || 0) >= 100)
  );

  // Record view when message becomes visible
  useEffect(() => {
    if (!user || !isViewEligible || isOwn) return;
    const recordView = async () => {
      try {
        const data = await recordMessageView(message.id);
        if (data && typeof data.view_count === "number") setViewCount(data.view_count);
      } catch {
        // viewing is best-effort
      }
    };
    recordView();
    // Deliberately narrow deps: this should fire once per (message, viewer) pair.
    // isOwn/isViewEligible are derived from message/user already covered below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, user?.id]);

  // For own monetized content, fetch view count
  useEffect(() => {
    if (!isOwn || !isViewEligible || localState) return;
    const fetchCount = async () => {
      try {
        const counts = await getMessageViewCounts(roomId ?? message.room_id, [message.id]);
        setViewCount(counts[message.id] ?? 0);
      } catch {
        setViewCount(0);
      }
    };
    fetchCount();
  }, [message.id, isOwn, isViewEligible, localState]);

  if (message.type === "system") {
    return (
      <div className="text-center text-xs text-muted-foreground py-1">{message.content}</div>
    );
  }

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { toast.error("Message can't be empty"); return; }
    if (!onEdit) return;
    setSaving(true);
    await onEdit(message.id, trimmed);
    setSaving(false);
    setIsEditing(false);
  };

  const runDelete = async (scope: "me" | "everyone") => {
    setDeleteOpen(false);
    await onDelete?.(message.id, scope);
  };
  const canEveryone = canDeleteForEveryone({ isSender: isOwn, isRoomAdmin: !!isAdmin, createdAt: message.created_at });

  // "Delete for everyone" leaves a quiet placeholder (like WhatsApp). Content, media and reactions are already gone.
  if (message.deleted_at) {
    return (
      <div className={`relative group/msg ${grouped ? "mt-0.5" : "mt-2"} animate-fade-in [-webkit-touch-callout:none]`} onContextMenu={onContextMenu} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
          {!isOwn && showAvatar && <div className="shrink-0 w-8 mr-1.5" />}
          <div className="max-w-[82%] min-w-0">
            <div className={`relative rounded-lg px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${isOwn ? "bubble-sent" : "bubble-received"} ${showHeader ? (isOwn ? "bubble-tail-out rounded-tr-none" : "bubble-tail-in rounded-tl-none") : ""}`}>
              {onDelete && (
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="Message options" className={`absolute top-0.5 right-0.5 z-10 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 ${isOwn ? "bg-[hsl(var(--sent-bubble))]" : "bg-[hsl(var(--received-bubble))]"}`}>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isOwn ? "end" : "start"}>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void onDelete(message.id, "me")}><Trash2 className="mr-2 h-4 w-4" />Delete for me</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <p className="text-[14px] leading-[19px] italic text-muted-foreground flex items-center gap-1.5 pr-1">
                <Ban className="w-3.5 h-3.5 shrink-0" />
                {isOwn ? "You deleted this message" : "This message was deleted"}
                <span aria-hidden className="inline-block w-10">&nbsp;</span>
              </p>
              <span className="absolute bottom-1 right-2 text-[11px] leading-none text-muted-foreground select-none">{time}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const nameColor = senderColor(message.sender_id);
  const isMedia = (message.type === "image" || message.type === "video") && !!message.media_url;
  const hasExtras = !!isGiftEligible || (isViewEligible && viewCount !== null && viewCount > 0);
  const caption = isMedia ? (message.content || "").trim() : "";
  const hasCaption = caption.length > 0;
  // Text keeps its time on the last line (spacer + absolutely placed meta). Everything else gets its own footer row.
  const inlineMeta = ((message.type === "text" && !isEditing) || hasCaption) && !hasExtras;
  const overlayMeta = isMedia && !hasExtras && !hasCaption;
  const tail = showHeader; // the first bubble of a run gets the speech-bubble tail

  const ticks = isOwn && !localState && status ? (
    status === "read" ? <CheckCheck className="w-4 h-4 text-sky-500" aria-label="Read" />
    : status === "delivered" ? <CheckCheck className="w-4 h-4 text-muted-foreground" aria-label="Delivered" />
    : <Check className="w-4 h-4 text-muted-foreground" aria-label="Sent" />
  ) : null;

  const meta = (onMedia: boolean) => (
    <span className={`inline-flex items-center gap-0.5 text-[11px] leading-none whitespace-nowrap select-none ${onMedia ? "text-white" : "text-muted-foreground"}`}>
      {message.edited_at && <span className="mr-0.5">edited</span>}
      {time}
      {isOwn && localState === "sending" && <Clock className="w-3 h-3" aria-label="Sending" />}
      {ticks}
    </span>
  );

  const replyPreview = replyInfo ? (
    <button
      onClick={(e) => { e.stopPropagation(); onScrollToMessage?.(replyInfo.id); }}
      className="mb-1 w-full block rounded-md bg-black/[0.06] dark:bg-white/[0.08] border-l-4 px-2 py-1 text-left text-[12.5px] cursor-pointer overflow-hidden"
      style={{ borderLeftColor: senderColor(replyInfo.senderId || replyInfo.id) }}
    >
      <span className="font-semibold inline-flex items-center gap-1 align-middle" style={{ color: senderColor(replyInfo.senderId || replyInfo.id) }}>
        {replyInfo.senderName}
        {replyInfo.senderId && <ProfileBadges userId={replyInfo.senderId} size="xs" />}
      </span>
      <p className="text-muted-foreground truncate">
        {replyInfo.type === "deleted" ? "🚫 This message was deleted" : replyInfo.type === "image" ? "📷 Photo" : replyInfo.type === "audio" ? "🎤 Voice note" : replyInfo.type === "video" ? "🎬 Video" : replyInfo.content || ""}
      </p>
    </button>
  ) : null;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const sideAvatar = !isOwn && showAvatar;

  return (
    <div
      className={`relative group/msg ${grouped ? "mt-0.5" : "mt-2"} animate-fade-in touch-pan-y [-webkit-touch-callout:none]`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={onContextMenu}
    >
      {/* Swipe-to-reply affordance */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-muted flex items-center justify-center pointer-events-none"
        style={{ opacity: Math.min(dx / SWIPE_REPLY_PX, 1), transform: `translateY(-50%) scale(${0.6 + Math.min(dx / SWIPE_REPLY_PX, 1) * 0.4})` }}
        aria-hidden
      >
        <CornerUpLeft className="w-4 h-4 text-muted-foreground" />
      </div>

      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 0.2s ease-out" }}
      >
        {sideAvatar && (
          <button onClick={() => setShowProfile(true)} className="shrink-0 w-8 mr-1.5 self-end">
            {showHeader && (
              <UserAvatar name={message.profile?.display_name || message.profile?.username} url={message.profile?.avatar_url} size="sm" />
            )}
          </button>
        )}

        <div className={`max-w-[82%] min-w-0 flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          <div
            className={`relative rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${overlayMeta ? "p-[3px]" : isMedia ? "p-1" : "px-2 pt-1 pb-1"} ${
              isOwn ? "bubble-sent" : "bubble-received"
            } ${tail ? (isOwn ? "bubble-tail-out rounded-tr-none" : "bubble-tail-in rounded-tl-none") : ""} ${message.type === "shared_post" || message.type === "shared_page_post" ? "w-[min(20rem,82vw)]" : ""}`}
          >
            {isPinned && <div className="absolute -top-2 right-2"><Pin className="w-3 h-3 text-primary" /></div>}

            {/* Menu chevron: appears on hover (desktop). Touch uses long-press; right-click works everywhere. */}
            {!localState && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Message options"
                    className={`absolute top-0.5 right-0.5 z-10 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 ${
                      isOwn ? "bg-[hsl(var(--sent-bubble))]" : "bg-[hsl(var(--received-bubble))]"
                    } ${overlayMeta ? "!text-white !bg-black/40" : ""}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? "end" : "start"}>
                  <DropdownMenuItem onClick={() => onReply?.(message)}><CornerUpLeft className="mr-2 h-4 w-4" />Reply</DropdownMenuItem>
                  {message.type === "text" && message.content && <DropdownMenuItem onClick={() => void copyText()}><Copy className="mr-2 h-4 w-4" />Copy</DropdownMenuItem>}
                  {onForward && isForwardable(message) && <DropdownMenuItem onClick={() => onForward(message)}><Forward className="mr-2 h-4 w-4" />Forward</DropdownMenuItem>}
                  {isOwn && message.type === "text" && <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>}
                  {isAdmin && onPin && <DropdownMenuItem onClick={() => onPin(message.id)}><Pin className="mr-2 h-4 w-4" />{isPinned ? "Unpin" : "Pin"}</DropdownMenuItem>}
                  {!isOwn && <DropdownMenuItem onClick={() => onReport?.(message)}><Flag className="mr-2 h-4 w-4" />Report</DropdownMenuItem>}
                  {!isOwn && <DropdownMenuItem onClick={() => onBlockUser?.(message.sender_id, message.profile?.display_name || message.profile?.username || "User")}><ShieldBan className="mr-2 h-4 w-4" />Block user</DropdownMenuItem>}
                  {onDelete && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => window.setTimeout(() => setDeleteOpen(true), 0)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Sender name lives inside the bubble, coloured per person (groups only) */}
            {!isOwn && showSenderName && showHeader && (
              <div className="flex items-center gap-1.5 pr-5">
                <p className="text-[12.5px] font-semibold leading-tight truncate" style={{ color: nameColor }}>{message.profile?.display_name || "User"}</p>
                {isSupportAgent(message.profile?.username) && <VerifiedBadge className="w-3 h-3" />}
                <ProfileBadges userId={message.sender_id} size="xs" />
                <RankBadge rank={message.profile?.rank || "Amateur"} size="sm" showLabel={false} />
              </div>
            )}

            {message.forwarded && (
              <p className="flex items-center gap-1 text-[12px] italic text-muted-foreground pr-5 pb-0.5"><Forward className="w-3 h-3" />Forwarded</p>
            )}

            {replyPreview}

            {message.type === "text" && isEditing ? (
              <div className="space-y-2 min-w-[14rem]">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="w-full resize-none rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setDraft(message.content || ""); setIsEditing(false); }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background"><X className="h-3.5 w-3.5" />Cancel</button>
                  <button onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"><Check className="h-3.5 w-3.5" />{saving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            ) : null}

            {message.type === "text" && !isEditing && (
              <p className="text-[14.2px] leading-[19px] text-foreground break-words whitespace-pre-wrap">
                {message.content ? renderRichText(message.content) : ""}
                {inlineMeta && <span aria-hidden className={`inline-block align-bottom ${isOwn ? (message.edited_at ? "w-[5.5rem]" : "w-[4.25rem]") : (message.edited_at ? "w-[4.75rem]" : "w-11")}`}>&nbsp;</span>}
              </p>
            )}
            {message.type === "shared_post" && <SharedPostMessage raw={message.content} />}
            {message.type === "shared_page_post" && <SharedPagePostMessage raw={message.content} />}
            {message.type === "image" && message.media_url && (
              <button onClick={() => setMediaViewer({ type: "image", url: message.media_url! })} className="block">
                <img src={message.media_url} alt="Shared image" className="rounded-md max-w-full max-h-72 min-w-[8rem] object-cover cursor-pointer" loading="lazy" />
              </button>
            )}
            {message.type === "video" && message.media_url && (
              <button onClick={() => setMediaViewer({ type: "video", url: message.media_url! })} className="block relative group">
                <video src={message.media_url} className="rounded-md max-w-full max-h-72 cursor-pointer" preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 rounded-md transition-colors">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                  </div>
                </div>
              </button>
            )}
            {hasCaption && (
              <p className="px-1 pt-1 text-[14.2px] leading-[19px] text-foreground break-words whitespace-pre-wrap">
                {renderRichText(caption)}
                {inlineMeta && <span aria-hidden className={`inline-block align-bottom ${isOwn ? (message.edited_at ? "w-[5.5rem]" : "w-[4.25rem]") : (message.edited_at ? "w-[4.75rem]" : "w-11")}`}>&nbsp;</span>}
              </p>
            )}
            {message.type === "audio" && message.media_url && (
              <VoiceNotePlayer src={message.media_url} duration={message.duration} />
            )}

            {/* Time + ticks */}
            {inlineMeta && <div className={`absolute bottom-1 ${hasCaption ? "right-2.5" : "right-2"}`}>{meta(false)}</div>}
            {overlayMeta && (
              <div className="absolute bottom-1.5 right-2 rounded-full bg-black/45 px-1.5 py-0.5">{meta(true)}</div>
            )}
            {!inlineMeta && !overlayMeta && (
              <div className="flex items-center justify-between gap-3 mt-0.5">
                <div className="flex items-center gap-2">
                  {isGiftEligible && (
                    <button onClick={() => setShowGiftDialog(true)} className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 font-semibold transition-colors">
                      <Gift className="w-3 h-3" /> Gift
                    </button>
                  )}
                  {isViewEligible && viewCount !== null && viewCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Eye className="w-3 h-3" /> {viewCount}
                    </span>
                  )}
                </div>
                <div className="ml-auto">{meta(false)}</div>
              </div>
            )}
          </div>

          {localState === "failed" && (
            <div className="mt-1 flex items-center justify-end gap-3 text-[11px] text-destructive">
              <span className="inline-flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Not sent</span>
              <button onClick={onRetry} className="font-semibold underline">Retry</button>
              <button onClick={onDiscard} className="text-muted-foreground underline">Delete</button>
            </div>
          )}
          {message.type !== "system" && !localState && (
            <MessageReactions messageId={message.id} isOwn={isOwn} />
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              {canEveryone
                ? "You can remove this message for everyone in the chat, or only for yourself."
                : isOwn
                ? "It's too late to delete this for everyone. You can still remove it from your own chat."
                : "This removes the message from your chat only. Other people will still see it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col items-stretch gap-1 pt-1">
            {canEveryone && <button onClick={() => void runDelete("everyone")} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-muted text-center">Delete for everyone</button>}
            <button onClick={() => void runDelete("me")} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-muted text-center">Delete for me</button>
            <button onClick={() => setDeleteOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted text-center">Cancel</button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <UserProfilePreview userId={message.sender_id} open={showProfile} onOpenChange={setShowProfile} />
      {isGiftEligible && roomId && (
        <GiftPostDialog open={showGiftDialog} onOpenChange={setShowGiftDialog} messageId={message.id} receiverId={message.sender_id} receiverName={message.profile?.display_name || message.profile?.username || "User"} roomId={roomId} />
      )}
      {mediaViewer && (
        <MediaViewer
          open={!!mediaViewer}
          onOpenChange={(open) => !open && setMediaViewer(null)}
          type={mediaViewer.type}
          url={mediaViewer.url}
        />
      )}
    </div>
  );
}
