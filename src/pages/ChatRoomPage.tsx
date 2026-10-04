import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useSocket } from "@/sockets/SocketContext";
import * as roomsApi from "@/api/rooms";
import * as messagesApi from "@/api/messages";
import * as callsApi from "@/api/calls";
import * as profilesApi from "@/api/profiles";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import UserAvatar from "@/components/UserAvatar";

import ReportDialog from "@/components/ReportDialog";
import { useCallContext } from "@/contexts/CallContext";
import { ArrowLeft, Flag, Phone, Video, ShieldBan, Users, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/types/database";
import CallLogSystemMessage from "@/components/CallLogSystemMessage";
import AclibBanner from "@/components/AclibBanner";
import SponsorFooterBanner from "@/components/monetization/SponsorFooterBanner";
import AdSlot from "@/components/ads/AdSlot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, submitModerationReport } from "@/lib/safety";
import { Textarea } from "@/components/ui/textarea";
import { canMakeVoiceCall, canMakeVideoCall } from "@/lib/callPermissions";
import { useMentionRecorder } from "@/hooks/useMentionRecorder";

type Message = Tables<"messages"> & { edited_at?: string | null; reply_to?: string | null };
type CallLog = Tables<"call_logs">;

interface UserSummary {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  rank?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
}

interface MessageWithProfile extends Message {
  profile?: UserSummary;
}

interface ReplyTarget {
  id: string;
  content: string | null;
  senderName: string;
  type: string;
}

const VIDEO_UPLOAD_RANKS = ["Professional", "Expert", "Master"];

function apiErrorMessage(err: unknown, fallback: string) {
  return (axios.isAxiosError(err) && (err.response?.data as { error?: string })?.error) || fallback;
}

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetMessageId = searchParams.get("messageId");
  const handledMessageIdRef = useRef<string | null>(null);
  const { user, profile } = useAuth();
  const socket = useSocket();
  const { setCurrentRoom, refetchUnreads } = useNotificationContext();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [room, setRoom] = useState<Tables<"rooms"> | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState<string | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinAnswers, setJoinAnswers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [dmPeer, setDmPeer] = useState<UserSummary | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<MessageWithProfile[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<
    | { type: "message"; message: MessageWithProfile }
    | { type: "room" }
    | null
  >(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [readyReadRoomId, setReadyReadRoomId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const navigate = useNavigate();
  const { typingUsers, broadcastTyping } = useTypingIndicator(roomId);

  const userRank = profile?.rank || "Amateur";
  const canVoiceCall = canMakeVoiceCall(userRank);
  const canVideoCall = canMakeVideoCall(userRank);
  const canUploadVideo = VIDEO_UPLOAD_RANKS.includes(userRank);

  const call = useCallContext();
  const { recordFromText } = useMentionRecorder();
  const savedLastReadRef = useRef<string | null>(null);

  // On enter: fetch last_read_at FIRST, save it, then mark as read
  useEffect(() => {
    if (!roomId || !user) return;

    let isActive = true;
    savedLastReadRef.current = null;
    setLastReadAt(null);
    setReadyReadRoomId(null);

    const init = async () => {
      setCurrentRoom(roomId);

      // 1. Fetch the ORIGINAL last_read_at (and the peer's, for DM ticks) before marking as read.
      const reads = await roomsApi.listRoomReads(roomId).catch(() => []);
      const own = reads.find((r) => r.user_id === user.id);
      const peer = reads.find((r) => r.user_id !== user.id);
      const originalLastRead = own?.last_read_at || null;
      if (!isActive) return;

      savedLastReadRef.current = originalLastRead;
      setLastReadAt(originalLastRead);
      if (peer) setPeerLastReadAt(peer.last_read_at);

      // 2. Now mark as read
      await roomsApi.markRoomRead(roomId).catch(() => {});

      if (!isActive) return;

      setReadyReadRoomId(roomId);
      refetchUnreads();
    };
    void init();

    return () => {
      isActive = false;
      setCurrentRoom(null);
      // Mark room as read on leave
      if (roomId && user) {
        roomsApi.markRoomRead(roomId).then(() => refetchUnreads()).catch(() => {});
      }
    };
  }, [roomId, setCurrentRoom, user, refetchUnreads]);

  useEffect(() => {
    if (!roomId || !user || !socket) return;
    void fetchRoom();
    void checkMembership();
    void fetchPinnedMessages();
    void fetchCallLogs();

    const refreshInterval = window.setInterval(() => void fetchRoom(), 30000);

    socket.emit("room:join", roomId);

    const onNewMessage = async (newMsg: Message) => {
      if (newMsg.room_id !== roomId) return;
      const profiles = await profilesApi.getProfilesByIds([newMsg.sender_id]).catch(() => []);
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, { ...newMsg, profile: profiles[0] || undefined }]));
    };
    const onEditMessage = (u: Message) => {
      if (u.room_id !== roomId) return;
      setMessages((prev) => prev.map((m) => (m.id === u.id ? { ...m, ...u } : m)));
    };
    const onDeleteMessage = (d: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== d.id));
    };
    const onCallLog = (log: CallLog) => {
      if (log.room_id !== roomId) return;
      setCallLogs((prev) => {
        const exists = prev.some((c) => c.id === log.id);
        const next = exists ? prev.map((c) => (c.id === log.id ? log : c)) : [...prev, log];
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    };
    const onRoomRead = (payload: { roomId: string; userId: string; lastReadAt: string }) => {
      if (payload.roomId !== roomId || payload.userId === user.id) return;
      setPeerLastReadAt(payload.lastReadAt);
    };

    socket.on("message:new", onNewMessage);
    socket.on("message:edit", onEditMessage);
    socket.on("message:delete", onDeleteMessage);
    socket.on("call:log", onCallLog);
    socket.on("room:read", onRoomRead);

    return () => {
      window.clearInterval(refreshInterval);
      socket.emit("room:leave", roomId);
      socket.off("message:new", onNewMessage);
      socket.off("message:edit", onEditMessage);
      socket.off("message:delete", onDeleteMessage);
      socket.off("call:log", onCallLog);
      socket.off("room:read", onRoomRead);
    };
    // Intentionally runs once per roomId/user/socket: fetchRoom/checkMembership/fetchPinnedMessages/
    // fetchCallLogs are plain (non-memoized) functions defined below and read current
    // roomId/user via closure; including them would cause this effect to tear down and
    // re-join the socket room on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user, socket]);

  useEffect(() => {
    if (!roomId || !user || readyReadRoomId !== roomId) return;
    void fetchMessages();
    // fetchMessages is a plain function defined below; deps already narrow
    // this to roomId/user/readyReadRoomId changes, which is the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user, readyReadRoomId]);

  // Deeplink: scroll to specific message id from ?messageId= (e.g. mention notifications)
  useEffect(() => {
    if (!targetMessageId || messages.length === 0) return;
    if (handledMessageIdRef.current === targetMessageId) return;
    const tryScroll = async () => {
      let exists = messages.some((m) => m.id === targetMessageId);
      // If not yet loaded (older), fetch a window centered on it and replace the list
      if (!exists && roomId) {
        const result = await messagesApi.getMessagesAround(roomId, targetMessageId).catch(() => null);
        if (result && result.messages.length) {
          setMessages(await attachProfiles(result.messages));
          setHasMore(result.hasMoreBefore);
          exists = true;
        }
      }
      handledMessageIdRef.current = targetMessageId;
      requestAnimationFrame(() => {
        const el = document.getElementById(`msg-${targetMessageId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2500);
        }
        const next = new URLSearchParams(searchParams);
        next.delete("messageId");
        setSearchParams(next, { replace: true });
      });
    };
    void tryScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMessageId, messages.length, roomId]);

  useEffect(() => {
    if (isInitialLoad.current) {
      // Scroll to unread divider if it exists, otherwise scroll to bottom
      requestAnimationFrame(() => {
        const unreadDivider = document.getElementById("unread-divider");
        if (unreadDivider) {
          unreadDivider.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }
      });
      isInitialLoad.current = false;
    } else {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  const fetchRoom = async () => {
    if (!roomId || !user) return;
    const data = await roomsApi.getRoom(roomId).catch(() => null);
    setRoom(data);
    const members = await roomsApi.listRoomMembers(roomId).catch(() => []);
    setMemberCount(members.length);
    if (members.length === 0) { setOnlineCount(0); setDmPeer(null); return; }

    setOnlineCount(members.filter((m) => m.profile?.is_online).length);
    if (data?.type === "dm") {
      const peer = members.find((m) => m.user_id !== user.id)?.profile || null;
      setDmPeer(peer || null);
    }
  };

  const checkMembership = async () => {
    if (!roomId || !user) return;
    const status = await roomsApi.getRoomMeStatus(roomId).catch(() => null);
    if (!status) return;
    setIsMember(status.isMember);
    setIsAdmin(status.role === "admin");
    setIsMuted(status.isMuted);
    if (!status.isMember) setJoinRequestStatus(status.joinRequestStatus);
  };

  const fetchPinnedMessages = async () => {
    if (!roomId) return;
    const pins = await roomsApi.listPinnedMessages(roomId).catch(() => []);
    const msgs = (pins as Array<{ message?: Message }>).map((p) => p.message).filter((m): m is Message => Boolean(m));
    setPinnedMessages(await attachProfiles(msgs));
  };

  const fetchCallLogs = async () => {
    if (!roomId) return;
    const data = await callsApi.listCallLogs(roomId).catch(() => []);
    setCallLogs(data as CallLog[]);
  };

  const joinRoom = async () => {
    if (!roomId || !user || !room) return;

    if (room.type === "private") {
      const fee = room.join_fee || 0;
      const questions: string[] = room.join_questions || [];

      // If there are questions and user hasn't filled them yet, show form
      if (questions.length > 0 && !showJoinForm) {
        setJoinAnswers(new Array(questions.length).fill(""));
        setShowJoinForm(true);
        return;
      }

      // Validate answers if questions exist
      if (questions.length > 0) {
        const unanswered = joinAnswers.some((a) => !a.trim());
        if (unanswered) {
          toast.error("Please answer all questions");
          return;
        }
      }

      // Fee deduction now happens atomically server-side, inside the same
      // transaction as creating the request — no separate deduct/refund calls here.
      try {
        await roomsApi.submitJoinRequest(roomId, questions.length > 0 ? joinAnswers : undefined);
        setJoinRequestStatus("pending");
        setShowJoinForm(false);
        toast.success(fee > 0 ? `Request sent! ${fee} coins deducted. 🙏` : "Join request sent! Waiting for admin approval. 🙏");
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          toast.info(apiErrorMessage(err, "Join request already sent"));
        } else {
          toast.error(apiErrorMessage(err, "Couldn't send join request"));
        }
      }
      return;
    }

    try {
      await roomsApi.joinRoom(roomId);
      setIsMember(true);
      setMemberCount((c) => c + 1);
      toast.success("Joined! 🎉");
      fetchMessages();
    } catch {
      toast.error("Couldn't join room");
    }
  };

  const PAGE_SIZE = 50;

  const attachProfiles = async (msgs: Message[]): Promise<MessageWithProfile[]> => {
    if (msgs.length === 0) return [];
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const profiles = await profilesApi.getProfilesByIds(senderIds).catch(() => []);
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    return msgs.map((m) => ({ ...m, profile: profileMap.get(m.sender_id) || undefined }));
  };

  const fetchMessages = async () => {
    if (!roomId || !user) return;
    isInitialLoad.current = true;

    // Jump straight to the first unread message (if any), else load the latest page.
    const { messages: data, hasMore: more } = await messagesApi
      .getUnreadMessages(roomId, savedLastReadRef.current)
      .catch(() => ({ messages: [] as Message[], hasMore: false }));

    if (data.length > 0) {
      setHasMore(more);
      setMessages(await attachProfiles(data));
    } else {
      setMessages([]);
      setHasMore(false);
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldestTimestamp = messages[0].created_at;
    const data = await messagesApi.listMessages(roomId, oldestTimestamp).catch(() => []);
    if (data.length > 0) {
      const withProfiles = await attachProfiles(data);
      // Preserve scroll position
      const container = messagesContainerRef.current;
      const prevHeight = container?.scrollHeight || 0;
      setMessages((prev) => [...withProfiles, ...prev]);
      setHasMore(data.length === PAGE_SIZE);
      // Restore scroll position after prepending
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight;
      });
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [roomId, loadingMore, hasMore, messages]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
    }
  }, []);

  const sendMessage = async (content: string, type: "text" | "image" | "audio" | "video" = "text", mediaUrl?: string, duration?: number, replyTo?: string) => {
    if (!roomId || !user) return;
    if (isMuted) { toast.error("You are muted in this room"); return; }
    if (room?.name === "📢 4GO Announcements") {
      toast.error("This is a broadcast-only channel");
      return;
    }
    try {
      const sent = await messagesApi.sendMessage(roomId, {
        type,
        content: type === "text" ? content : undefined,
        media_url: mediaUrl || undefined,
        duration: duration || undefined,
        reply_to: replyTo,
      });
      if (type === "text" && content) {
        void recordFromText(content, { sourceType: "message", sourceId: sent.id, contextId: roomId });
      }
    } catch (err) {
      console.error("Message send error:", err);
      toast.error(apiErrorMessage(err, "Failed to send message"));
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!user) return;
    try {
      const updated = await messagesApi.editMessage(messageId, content);
      setMessages((c) => c.map((m) => (m.id === messageId ? { ...m, content, edited_at: updated.edited_at } : m)));
      toast.success("Message updated");
    } catch {
      toast.error("Couldn't edit message");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user || !window.confirm("Delete this message?")) return;
    try {
      await messagesApi.deleteMessage(messageId);
      setMessages((c) => c.filter((m) => m.id !== messageId));
      toast.success("Message deleted");
    } catch {
      toast.error("Couldn't delete message");
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!roomId || !user) return;
    const existing = pinnedMessages.find((m) => m.id === messageId);
    try {
      if (existing) {
        await roomsApi.unpinMessage(roomId, messageId);
        setPinnedMessages((c) => c.filter((m) => m.id !== messageId));
        toast.success("Message unpinned");
      } else {
        await roomsApi.pinMessage(roomId, messageId);
        const msg = messages.find((m) => m.id === messageId);
        if (msg) setPinnedMessages((c) => [...c, msg]);
        toast.success("Message pinned");
      }
    } catch {
      toast.error("Couldn't pin message");
    }
  };

  const handleReply = (msg: MessageWithProfile) => {
    setReplyTarget({
      id: msg.id,
      content: msg.content,
      senderName: msg.profile?.display_name || msg.profile?.username || "User",
      type: msg.type,
    });
  };

  // Build a map of reply info, fetching missing originals from the API
  const [replyMap, setReplyMap] = useState(new Map<string, { id: string; content: string | null; senderName: string; senderId?: string; type: string }>());

  useEffect(() => {
    const buildReplyMap = async () => {
      const map = new Map<string, { id: string; content: string | null; senderName: string; senderId?: string; type: string }>();
      const missingIds: string[] = [];

      for (const msg of messages) {
        if (msg.reply_to) {
          const original = messages.find((m) => m.id === msg.reply_to);
          if (original) {
            map.set(msg.id, {
              id: original.id,
              content: original.content,
              senderName: original.profile?.display_name || original.profile?.username || "User",
              senderId: original.sender_id,
              type: original.type,
            });
          } else {
            missingIds.push(msg.reply_to);
          }
        }
      }

      // Fetch missing reply targets from the API
      if (missingIds.length > 0 && roomId) {
        const uniqueIds = [...new Set(missingIds)];
        const missingMsgs = await messagesApi.getMessagesByIds(roomId, uniqueIds).catch(() => []);
        if (missingMsgs.length > 0) {
          const senderIds = [...new Set(missingMsgs.map((m) => m.sender_id))];
          const profiles = await profilesApi.getProfilesByIds(senderIds).catch(() => []);
          const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

          for (const msg of messages) {
            if (msg.reply_to && !map.has(msg.id)) {
              const original = missingMsgs.find((m) => m.id === msg.reply_to);
              if (original) {
                const prof = profileMap.get(original.sender_id);
                map.set(msg.id, {
                  id: original.id,
                  content: original.content,
                  senderName: prof?.display_name || prof?.username || "User",
                  senderId: original.sender_id,
                  type: original.type,
                });
              }
            }
          }
        }
      }

      setReplyMap(map);
    };

    buildReplyMap();
  }, [messages, roomId]);

  const handleBlockUser = async (targetUserId: string, name: string) => {
    if (!user || targetUserId === user.id) return;
    const confirmed = window.confirm(`Block ${name}?`);
    if (!confirmed) return;
    const { error } = await blockUser({ blockerId: user.id, blockedId: targetUserId, reason: "Blocked from chat" });
    if (error) { toast.error("Couldn't block user"); return; }
    setMessages((c) => c.filter((m) => m.sender_id !== targetUserId));
    toast.success(`${name} blocked`);
    if (room?.type === "dm") navigate("/dms");
  };

  const handleSubmitReport = async (reason: string, details: string) => {
    if (!user || !reportTarget) return;
    const payload = reportTarget.type === "room"
      ? { reporterId: user.id, reason, details, targetRoomId: roomId }
      : { reporterId: user.id, reason, details, targetMessageId: reportTarget.message.id, targetUserId: reportTarget.message.sender_id, targetRoomId: roomId };
    const { error } = await submitModerationReport(payload);
    if (error) { toast.error("Couldn't submit report"); return; }
    toast.success("Report submitted");
    setReportTarget(null);
  };

  // WhatsApp-style day divider label ("Today" / "Yesterday" / "3 March").
  const formatDayDivider = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (sameDay(d, now)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";
    return d.toLocaleDateString([], {
      day: "numeric",
      month: "long",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Consecutive messages from the same sender within this window are grouped
  // together (no repeated avatar/name, tighter spacing) like WhatsApp.
  const GROUP_WINDOW_MS = 5 * 60 * 1000;

  const roomTitle = room?.type === "dm" ? dmPeer?.display_name || dmPeer?.username || "Direct Message" : room?.name || "Loading...";
  const isAnnouncementRoom = room?.name === "📢 4GO Announcements";
  const roomSubtitle = room?.type === "dm" ? (dmPeer?.is_online ? "Online now" : "Offline") : `${memberCount} members · ${onlineCount} online`;
  const conversationItems: Array<
    | { kind: "message"; created_at: string; item: MessageWithProfile }
    | { kind: "call_log"; created_at: string; item: CallLog }
  > = [
    ...messages.map((message) => ({ kind: "message" as const, created_at: message.created_at, item: message })),
    ...(room?.type === "dm"
      ? callLogs.map((callLog) => ({ kind: "call_log" as const, created_at: callLog.created_at, item: callLog }))
      : []),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <AclibBanner />
      <AdSlot placement="room" />
      <div className="gradient-primary px-4 pt-10 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="text-primary-foreground"><ArrowLeft className="w-6 h-6" /></button>
        <button onClick={() => room?.type !== "dm" && navigate(`/room/${roomId}/members`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {room?.type === "dm" ? <UserAvatar name={dmPeer?.display_name || dmPeer?.username} url={dmPeer?.avatar_url} size="md" online={dmPeer?.is_online} showOnline /> : null}
          <div className="min-w-0">
            <h1 className="text-base font-display font-bold text-primary-foreground truncate">{roomTitle}</h1>
            <div className="flex items-center gap-1 text-primary-foreground/70 text-xs">
              {room?.type !== "dm" ? <Users className="w-3 h-3" /> : null}
              <span>{roomSubtitle}</span>
            </div>
          </div>
        </button>

        {room?.type === "dm" && dmPeer && (
          <div className="flex gap-1">
            {canVoiceCall && <button onClick={() => call.startCall(roomId || "", dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User", "voice")} className="p-2 text-primary-foreground/80 hover:text-primary-foreground" title="Voice call"><Phone className="w-5 h-5" /></button>}
            {canVideoCall && <button onClick={() => call.startCall(roomId || "", dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User", "video")} className="p-2 text-primary-foreground/80 hover:text-primary-foreground" title="Video call"><Video className="w-5 h-5" /></button>}
          </div>
        )}

        {pinnedMessages.length > 0 && (
          <button onClick={() => setShowPinned(!showPinned)} className="p-2 text-primary-foreground/80 relative">
            <Pin className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full text-[9px] text-destructive-foreground flex items-center justify-center font-bold">{pinnedMessages.length}</span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="text-primary-foreground/80"><Flag className="w-5 h-5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {room?.type !== "dm" && <DropdownMenuItem onClick={() => navigate(`/room/${roomId}/members`)}><Users className="mr-2 h-4 w-4" />View members</DropdownMenuItem>}
            {room?.type === "dm" && dmPeer && <DropdownMenuItem onClick={() => void handleBlockUser(dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User")}><ShieldBan className="mr-2 h-4 w-4" />Block user</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => setReportTarget({ type: "room" })}><Flag className="mr-2 h-4 w-4" />Report room</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pinned messages bar */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="bg-primary/5 border-b border-border px-4 py-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</span>
            <button onClick={() => setShowPinned(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          {pinnedMessages.map((pm) => (
            <div key={pm.id} className="text-xs text-foreground bg-card rounded-lg px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-accent/50"
              onClick={() => {
                setShowPinned(false);
                const el = document.getElementById(`msg-${pm.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-primary", "ring-offset-2");
                  setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
                }
              }}
            >
              <span className="truncate">{pm.profile?.display_name}: {pm.content || "[media]"}</span>
              {isAdmin && <button onClick={(e) => { e.stopPropagation(); handlePinMessage(pm.id); }} className="text-muted-foreground hover:text-destructive ml-2"><X className="w-3 h-3" /></button>}
            </div>
          ))}
        </div>
      )}

      {/* Muted notice */}
      {isMuted && (
        <div className="bg-destructive/10 text-destructive text-xs text-center py-2 px-4">
          You are muted in this room
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        onScroll={(e) => {
          if (e.currentTarget.scrollTop < 100) void loadOlderMessages();
        }}
      >
        {loadingMore && (
          <div className="text-center py-2">
            <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {(() => {
          let newDividerShown = false;
          let prevDateKey: string | null = null;
          let prevMessageEntry: { created_at: string; item: MessageWithProfile } | null = null;

          return conversationItems.map((entry) => {
            const isUnread = lastReadAt && entry.created_at > lastReadAt && (entry.kind !== "message" || entry.item.sender_id !== user?.id) && !newDividerShown;
            if (isUnread) newDividerShown = true;

            const dateKey = new Date(entry.created_at).toDateString();
            const showDateDivider = dateKey !== prevDateKey;
            if (showDateDivider) {
              prevDateKey = dateKey;
              prevMessageEntry = null; // grouping never spans a day boundary
            }

            let showHeader = true;
            let grouped = false;
            let status: "sent" | "delivered" | "read" | undefined;

            if (entry.kind === "message") {
              const sameSenderRecently =
                !!prevMessageEntry &&
                prevMessageEntry.item.sender_id === entry.item.sender_id &&
                new Date(entry.created_at).getTime() - new Date(prevMessageEntry.created_at).getTime() < GROUP_WINDOW_MS;
              showHeader = !sameSenderRecently;
              grouped = sameSenderRecently;

              if (entry.item.sender_id === user?.id) {
                if (room?.type === "dm") {
                  status = peerLastReadAt && entry.created_at <= peerLastReadAt ? "read" : "delivered";
                } else {
                  status = "delivered";
                }
              }
              prevMessageEntry = entry;
            } else {
              prevMessageEntry = null; // a call log also breaks visual grouping
            }

            return (
              <div key={`${entry.kind}-${entry.item.id}`}>
                {showDateDivider && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-3 py-1 shadow-sm">
                      {formatDayDivider(entry.created_at)}
                    </span>
                  </div>
                )}
                {isUnread && (
                  <div id="unread-divider" className="flex items-center gap-2 py-2">
                    <div className="flex-1 h-px bg-destructive/50" />
                    <span className="text-[10px] font-bold text-destructive uppercase">New Messages</span>
                    <div className="flex-1 h-px bg-destructive/50" />
                  </div>
                )}
                {entry.kind === "call_log" ? (
                  <CallLogSystemMessage
                    callLog={entry.item}
                    isCurrentUserCaller={entry.item.caller_id === user?.id}
                  />
                ) : (
                  <div id={`msg-${entry.item.id}`} className="transition-all duration-300">
                    <ChatMessage
                      message={entry.item}
                      isOwn={entry.item.sender_id === user?.id}
                      isAdmin={isAdmin}
                      roomId={roomId}
                      onEdit={editMessage}
                      onDelete={deleteMessage}
                      onReport={(message) => setReportTarget({ type: "message", message })}
                      onBlockUser={handleBlockUser}
                      onPin={room?.type !== "dm" ? handlePinMessage : undefined}
                      onReply={handleReply}
                      isPinned={pinnedMessages.some((pm) => pm.id === entry.item.id)}
                      replyInfo={replyMap.get(entry.item.id) || null}
                      onScrollToMessage={scrollToMessage}
                      status={status}
                      showHeader={showHeader}
                      grouped={grouped}
                    />
                  </div>
                )}
              </div>
            );
          });
        })()}
        <TypingIndicator typingUsers={typingUsers} />
        <div ref={messagesEndRef} />
      </div>

      {isAnnouncementRoom ? (
        <div className="p-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            📢 This is an official 4GO broadcast channel. Only announcements from the 4GO team appear here — replies are disabled.
          </p>
        </div>
      ) : isMember ? (
        <ChatInput
          onSend={sendMessage}
          roomId={roomId!}
          onTyping={() => broadcastTyping(profile?.display_name || "Someone")}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          canUploadVideo={canUploadVideo}
        />
      ) : (
        <div className="p-4 border-t border-border space-y-3 max-h-[60vh] overflow-y-auto">
          {room?.type === "private" && room?.rules && (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-semibold text-foreground mb-1">📋 Room Rules</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{room.rules}</p>
            </div>
          )}
          {room?.type === "private" && (room?.join_fee || 0) > 0 && (
            <p className="text-xs text-center text-muted-foreground">Joining fee: <span className="font-bold text-primary">{room.join_fee} coins</span> (deducted on request)</p>
          )}

          {/* Questions form */}
          {showJoinForm && (room?.join_questions || []).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground">📝 Answer these questions to join:</p>
              {(room.join_questions as string[]).map((q: string, i: number) => (
                <div key={i}>
                  <p className="text-xs font-medium text-foreground mb-1">{q}</p>
                  <Textarea
                    value={joinAnswers[i] || ""}
                    onChange={(e) => {
                      const updated = [...joinAnswers];
                      updated[i] = e.target.value;
                      setJoinAnswers(updated);
                    }}
                    placeholder="Your answer..."
                    maxLength={300}
                    className="rounded-xl resize-none text-sm"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}

          {joinRequestStatus === "pending" ? (
            <div className="w-full h-12 rounded-xl bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">⏳ Request Pending</div>
          ) : joinRequestStatus === "rejected" ? (
            <div className="w-full h-12 rounded-xl bg-destructive/10 flex items-center justify-center text-sm font-semibold text-destructive">Request Declined</div>
          ) : (
            <button onClick={joinRoom} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-elevated">
              {showJoinForm ? "Submit Request 🔒" : room?.type === "private" ? "Request to Join 🔒" : "Join Room"}
            </button>
          )}
        </div>
      )}

      <ReportDialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)} title={reportTarget?.type === "room" ? "Report this room" : "Report this message"} description={reportTarget?.type === "room" ? "Tell us what makes this room unsafe or abusive." : "Tell us what is wrong with this message."} onSubmit={handleSubmitReport} />
      <SponsorFooterBanner />
    </div>
  );
}
