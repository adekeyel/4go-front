import { useState, useEffect } from "react";
import { renderRichText } from "@/lib/mentions";
import SharedPostMessage from "@/components/feed/SharedPostMessage";
import SharedPagePostMessage from "@/components/feed/SharedPagePostMessage";
import MessageReactions from "@/components/MessageReactions";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Check, CornerUpLeft, Eye, Flag, Gift, Mic, MoreVertical, Pencil, Pin, ShieldBan, Trash2, X } from "lucide-react";
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

type Message = Tables<"messages"> & { edited_at?: string | null; reply_to?: string | null };

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
  onDelete?: (messageId: string) => Promise<void>;
  onReport?: (message: Message) => void;
  onBlockUser?: (userId: string, name: string) => void;
  onPin?: (messageId: string) => void;
  onReply?: (message: Message & { profile?: { display_name: string | null } }) => void;
  isPinned?: boolean;
  replyInfo?: ReplyInfo | null;
  onScrollToMessage?: (messageId: string) => void;
}

export default function ChatMessage({ message, isOwn, isAdmin, roomId, onEdit, onDelete, onReport, onBlockUser, onPin, onReply, isPinned, replyInfo, onScrollToMessage }: ChatMessageProps) {
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
      const { data } = await supabase.rpc("record_message_view", {
        p_user_id: user.id,
        p_message_id: message.id,
      });
      if (data && typeof data === "object" && "view_count" in (data as any)) {
        setViewCount((data as any).view_count);
      }
    };
    recordView();
  }, [message.id, user?.id]);

  // For own monetized content, fetch view count
  useEffect(() => {
    if (!isOwn || !isViewEligible) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("message_views")
        .select("id", { count: "exact", head: true })
        .eq("message_id", message.id);
      setViewCount(count || 0);
    };
    fetchCount();
  }, [message.id, isOwn, isViewEligible]);

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

  const replyPreview = replyInfo ? (
    <button
      onClick={() => onScrollToMessage?.(replyInfo.id)}
      className="mb-1 px-2 py-1 rounded-lg bg-primary/10 border-l-2 border-primary text-[11px] cursor-pointer text-left w-full block"
    >
      <span className="font-semibold text-primary inline-flex items-center gap-1 align-middle">
        {replyInfo.senderName}
        {replyInfo.senderId && <ProfileBadges userId={replyInfo.senderId} size="xs" />}
      </span>
      <p className="text-muted-foreground truncate">
        {replyInfo.type === "image" ? "📷 Photo" : replyInfo.type === "audio" ? "🎤 Voice note" : replyInfo.type === "video" ? "🎬 Video" : replyInfo.content || ""}
      </p>
    </button>
  ) : null;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isOwn && (
        <button onClick={() => setShowProfile(true)} className="shrink-0">
          <UserAvatar name={message.profile?.display_name || message.profile?.username} url={message.profile?.avatar_url} size="sm" className="mr-2 mt-5" />
        </button>
      )}

      <div className={`max-w-[80%] ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 mb-0.5 ml-1">
            <p className="text-[10px] text-primary font-semibold">{message.profile?.display_name || "User"}</p>
            {isSupportAgent(message.profile?.username) && <VerifiedBadge className="w-3 h-3" />}
            <ProfileBadges userId={message.sender_id} size="xs" />
            <RankBadge rank={message.profile?.rank || "Amateur"} size="sm" showLabel={false} />
          </div>
        )}
        <div className={`rounded-2xl px-3 py-2 relative ${isOwn ? "bubble-sent rounded-br-md" : "bubble-received rounded-bl-md shadow-card"}`}>
          {isPinned && <div className="absolute -top-2 right-2"><Pin className="w-3 h-3 text-primary" /></div>}
          <div className="mb-1 flex items-start justify-end gap-2">
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"}>
                <DropdownMenuItem onClick={() => onReply?.(message)}><CornerUpLeft className="mr-2 h-4 w-4" />Reply</DropdownMenuItem>
                {isOwn && message.type === "text" && <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit message</DropdownMenuItem>}
                {isOwn ? (
                  <DropdownMenuItem onClick={() => void onDelete?.(message.id)}><Trash2 className="mr-2 h-4 w-4" />Delete message</DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => onReport?.(message)}><Flag className="mr-2 h-4 w-4" />Report message</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBlockUser?.(message.sender_id, message.profile?.display_name || message.profile?.username || "User")}><ShieldBan className="mr-2 h-4 w-4" />Block user</DropdownMenuItem>
                  </>
                )}
                {isAdmin && onPin && <DropdownMenuItem onClick={() => onPin(message.id)}><Pin className="mr-2 h-4 w-4" />{isPinned ? "Unpin" : "Pin message"}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {replyPreview}

          {message.type === "text" && isEditing ? (
            <div className="space-y-2">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="w-full resize-none rounded-xl bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setDraft(message.content || ""); setIsEditing(false); }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background"><X className="h-3.5 w-3.5" />Cancel</button>
                <button onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"><Check className="h-3.5 w-3.5" />{saving ? "Saving..." : "Save"}</button>
              </div>
            </div>
          ) : null}

          {message.type === "text" && !isEditing && <p className="text-sm text-foreground break-words whitespace-pre-wrap">{message.content ? renderRichText(message.content) : ""}</p>}
          {message.type === "shared_post" && <SharedPostMessage raw={message.content} />}
          {message.type === "shared_page_post" && <SharedPagePostMessage raw={message.content} />}
          {message.type === "image" && message.media_url && (
            <button onClick={() => setMediaViewer({ type: "image", url: message.media_url! })} className="block">
              <img src={message.media_url} alt="Shared image" className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" />
            </button>
          )}
          {message.type === "video" && message.media_url && (
            <button onClick={() => setMediaViewer({ type: "video", url: message.media_url! })} className="block relative group">
              <video src={message.media_url} className="rounded-lg max-w-full max-h-60 cursor-pointer" preload="metadata" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 rounded-lg transition-colors">
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                </div>
              </div>
            </button>
          )}
          {message.type === "audio" && message.media_url && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"><Mic className="w-4 h-4 text-primary-foreground" /></div>
              <audio controls src={message.media_url} className="h-8 max-w-[200px]" />
              {message.duration && <span className="text-[10px] text-muted-foreground">{message.duration}s</span>}
            </div>
          )}
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-2">
              {isGiftEligible && (
                <button onClick={() => setShowGiftDialog(true)} className="flex items-center gap-0.5 text-[9px] text-primary hover:text-primary/80 font-semibold transition-colors">
                  <Gift className="w-3 h-3" /> Gift
                </button>
              )}
              {isViewEligible && viewCount !== null && viewCount > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Eye className="w-3 h-3" /> {viewCount}
                </span>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground text-right flex-1">{message.edited_at ? "edited • " : ""}{time}</p>
          </div>
        </div>
        {message.type !== "system" && (
          <MessageReactions messageId={message.id} isOwn={isOwn} />
        )}
      </div>
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
