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
import { ArrowLeft, Bell, BellOff, ChevronDown, Eraser, Flag, MoreVertical, Phone, Video, ShieldBan, Users, Pin, X } from "lucide-react";
import { formatLastSeen } from "@/lib/lastSeen";
import { toast } from "sonner";
import { Tables } from "@/types/database";
import CallLogSystemMessage from "@/components/CallLogSystemMessage";
import ForwardDialog from "@/components/ForwardDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AclibBanner from "@/components/AclibBanner";
import SponsorFooterBanner from "@/components/monetization/SponsorFooterBanner";
import AdSlot from "@/components/ads/AdSlot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, submitModerationReport } from "@/lib/safety";
import { Textarea } from "@/components/ui/textarea";
import { canMakeVoiceCall, canMakeVideoCall } from "@/lib/callPermissions";
import { useMentionRecorder } from "@/hooks/useMentionRecorder";

type Message = Tables<"messages"> & { edited_at?: string | null; reply_to?: string | null; client_id?: string };
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
  /** Set when the message was deleted for everyone (shown as "This message was deleted"). */
  deleted_at?: string | null;
  /** True when this is a copy of a message forwarded from another chat. */
  forwarded?: boolean | null;
  profile?: UserSummary;
  /** Present only on a message that was typed on this device and hasn't been confirmed by the server yet. */
  local?: { state: "sending" | "failed"; clientId: string };
}

const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
  const [peerDeliveredAt, setPeerDeliveredAt] = useState<string | null>(null);
  const readTimerRef = useRef<number | null>(null);
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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<MessageWithProfile | null>(null);
  const [prefs, setPrefs] = useState<roomsApi.ChatPrefs | null>(null); // my mute / clear-chat settings for this room
  const [clearOpen, setClearOpen] = useState(false);
  const [awayUnread, setAwayUnread] = useState(0); // new messages from others that arrived while scrolled up
  const prevLastMessageIdRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const { typingUsers, broadcastTyping } = useTypingIndicator(roomId);

  const userRank = profile?.rank || "Amateur";
  const canVoiceCall = canMakeVoiceCall(userRank);
  const canVideoCall = canMakeVideoCall(userRank);
  const canUploadVideo = VIDEO_UPLOAD_RANKS.includes(userRank);

  const call = useCallContext();
  const { recordFromText } = useMentionRecorder();
  const savedLastReadRef = useRef<string | null>(null);
  const forceScrollRef = useRef(false); // after you send something, jump to the bottom even if you'd scrolled up a little
  const ownSummaryRef = useRef<UserSummary | undefined>(undefined);
  ownSummaryRef.current = user
    ? { user_id: user.id, display_name: profile?.display_name ?? null, avatar_url: profile?.avatar_url ?? null, username: profile?.username ?? null, rank: profile?.rank }
    : undefined;

  // On enter: fetch last_read_at FIRST, save it, then mark as read
  useEffect(() => {
    if (!roomId || !user) return;

    let isActive = true;
    savedLastReadRef.current = null;
    setLastReadAt(null);
    setPeerLastReadAt(null); // don't show the previous chat's ticks while this one loads
    setPeerDeliveredAt(null);
    setReadyReadRoomId(null);

    const init = async () => {
      setCurrentRoom(roomId);

      // 1. Fetch the ORIGINAL last_read_at (and the peer's, for DM ticks) before marking as read.
      const receipts = await roomsApi.getRoomReceipts(roomId).catch(() => null);
      const reads: roomsApi.RoomReceipt[] =
        receipts ??
        (await roomsApi.listRoomReads(roomId).catch(() => [])).map((r) => ({ user_id: r.user_id, last_read_at: r.last_read_at as string | null, last_delivered_at: null }));
      const own = reads.find((r) => r.user_id === user.id);
      const peer = reads.find((r) => r.user_id !== user.id);
      const originalLastRead = own?.last_read_at || null;
      if (!isActive) return;

      savedLastReadRef.current = originalLastRead;
      setLastReadAt(originalLastRead);
      if (peer) {
        setPeerLastReadAt(peer.last_read_at);
        setPeerDeliveredAt(peer.last_delivered_at);
      }

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

    // The server forgets which rooms a socket joined whenever the connection drops and comes back (phone sleeps,
    // wifi blip, server restart). Without re-joining, live messages and typing silently stopped until a reload.
    const joinRoom = () => socket.emit("room:join", roomId);
    joinRoom();

    // Pull the newest page and add whatever we missed while disconnected / in the background.
    const catchUp = async () => {
      const latest = await messagesApi.listMessages(roomId).catch(() => null);
      if (!latest || latest.length === 0) return;
      const withProfiles = await attachProfiles(latest);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const fresh = withProfiles.filter((m) => !known.has(m.id));
        if (fresh.length === 0) return prev;
        const confirmed = prev.filter((m) => !m.local);
        const newestHave = confirmed.length ? confirmed[confirmed.length - 1].created_at : null;
        const gap = newestHave !== null && latest[0].created_at > newestHave && latest.length === PAGE_SIZE;
        // A gap means we were away for more than a page of messages: show the latest page instead of a patchwork.
        const base = gap ? [] : prev.filter((m) => !m.local);
        const merged = [...base, ...fresh].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        if (gap) setHasMore(true);
        return [...merged, ...prev.filter((m) => m.local)];
      });
    };
    const refreshReceipts = async () => {
      const r = await roomsApi.getRoomReceipts(roomId).catch(() => null);
      const peer = r?.find((x) => x.user_id !== user.id);
      if (peer) {
        setPeerLastReadAt(peer.last_read_at);
        setPeerDeliveredAt(peer.last_delivered_at);
      }
    };
    // While you're looking at the chat, what the other person sends counts as read right away (so THEIR ticks
    // turn blue now, not only when you leave the chat). Batched so a burst of messages makes one request.
    const markReadSoon = () => {
      if (readTimerRef.current) return;
      readTimerRef.current = window.setTimeout(() => {
        readTimerRef.current = null;
        roomsApi.markRoomRead(roomId).then(() => refetchUnreads()).catch(() => {});
      }, 800);
    };
    const onReconnected = () => { joinRoom(); void catchUp(); void fetchCallLogs(); void refreshReceipts(); };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void catchUp();
      void refreshReceipts();
      markReadSoon();
    };
    const onDelivered = (p: { roomId: string; userId: string; deliveredAt: string }) => {
      if (p.roomId !== roomId || p.userId === user.id) return;
      setPeerDeliveredAt((prev) => (!prev || new Date(p.deliveredAt).getTime() > new Date(prev).getTime() ? p.deliveredAt : prev));
    };
    socket.on("room:delivered", onDelivered);
    socket.on("connect", joinRoom);
    socket.io.on("reconnect", onReconnected);
    document.addEventListener("visibilitychange", onVisible);

    const onNewMessage = async (newMsg: Message) => {
      if (newMsg.room_id !== roomId) return;
      const mine = newMsg.sender_id === user.id;
      if (!mine && document.visibilityState === "visible") markReadSoon();
      const profiles = mine ? [] : await profilesApi.getProfilesByIds([newMsg.sender_id]).catch(() => []);
      const sender = mine ? ownSummaryRef.current : profiles[0] || undefined;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        // This is the saved copy of a message we're already showing as "sending": swap it in, don't add a second.
        const pending = newMsg.client_id ? prev.findIndex((m) => m.local?.clientId === newMsg.client_id) : -1;
        if (pending >= 0) {
          const next = [...prev];
          next[pending] = { ...newMsg, profile: prev[pending].profile ?? sender };
          return next;
        }
        return [...prev, { ...newMsg, profile: sender }];
      });
    };
    const onEditMessage = (u: Message) => {
      if (u.room_id !== roomId) return;
      setMessages((prev) => prev.map((m) => (m.id === u.id ? { ...m, ...u } : m)));
    };
    const onDeleteMessage = (d: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== d.id));
    };
    // "Delete for everyone": the message stays as a "This message was deleted" placeholder, its content is gone.
    const onRevokeMessage = (d: { id: string; room_id: string; deleted_at: string }) => {
      if (d.room_id !== roomId) return;
      setMessages((prev) => prev.map((m) => (m.id === d.id ? { ...m, deleted_at: d.deleted_at, content: null, media_url: null, duration: null, edited_at: null } : m)));
      setPinnedMessages((prev) => prev.filter((m) => m.id !== d.id));
    };
    // "Clear chat" done on another tab/device of mine.
    const onCleared = (d: { roomId: string }) => {
      if (d.roomId !== roomId) return;
      setMessages([]);
      setCallLogs([]);
      setPinnedMessages([]);
    };
    const onPrefs = (d: roomsApi.ChatPrefs & { room_id: string }) => {
      if (d.room_id === roomId) setPrefs(d);
    };
    // "Delete for me" done on another tab/device of mine.
    const onHideMessage = (d: { id: string; roomId: string }) => {
      if (d.roomId !== roomId) return;
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
    socket.on("chat:cleared", onCleared);
    socket.on("chat:prefs", onPrefs);
    socket.on("message:revoked", onRevokeMessage);
    socket.on("message:hidden", onHideMessage);
    socket.on("call:log", onCallLog);
    socket.on("room:read", onRoomRead);

    return () => {
      window.clearInterval(refreshInterval);
      socket.off("connect", joinRoom);
      socket.off("room:delivered", onDelivered);
      if (readTimerRef.current) { window.clearTimeout(readTimerRef.current); readTimerRef.current = null; }
      socket.io.off("reconnect", onReconnected);
      document.removeEventListener("visibilitychange", onVisible);
      socket.emit("room:leave", roomId);
      socket.off("message:new", onNewMessage);
      socket.off("message:edit", onEditMessage);
      socket.off("message:delete", onDeleteMessage);
      socket.off("chat:cleared", onCleared);
      socket.off("chat:prefs", onPrefs);
      socket.off("message:revoked", onRevokeMessage);
      socket.off("message:hidden", onHideMessage);
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
        if (isNearBottom || forceScrollRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          setAwayUnread(0);
        } else {
          // Scrolled up reading history: don't yank the view, just count what's new (like WhatsApp's badge).
          const prevId = prevLastMessageIdRef.current;
          const prevIdx = prevId ? messages.findIndex((m) => m.id === prevId) : -1;
          if (prevIdx >= 0) {
            const incoming = messages.slice(prevIdx + 1).filter((m) => m.sender_id !== user?.id).length;
            if (incoming > 0) setAwayUnread((n) => n + incoming);
          }
        }
      }
      forceScrollRef.current = false;
    }
    prevLastMessageIdRef.current = messages.length ? messages[messages.length - 1].id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setAwayUnread(0);
  }, []);

  // Reset the away-state when switching rooms
  useEffect(() => {
    setShowScrollDown(false);
    setAwayUnread(0);
    prevLastMessageIdRef.current = null;
  }, [roomId]);

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

  useEffect(() => {
    setPrefs(null);
    if (!roomId) return;
    let cancelled = false;
    roomsApi.getChatPrefs().then((all) => { if (!cancelled) setPrefs(all.find((p) => p.room_id === roomId) ?? null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [roomId]);

  const chatMuted = !!prefs?.muted_until && new Date(prefs.muted_until).getTime() > Date.now(); // my notification mute (not the admin "muted member" flag)

  const setMute = async (choice: roomsApi.MuteChoice) => {
    if (!roomId) return;
    try {
      const updated = await roomsApi.updateChatPrefs(roomId, { muted: choice });
      setPrefs(updated);
      toast.success(choice === "off" ? "Notifications on" : "Chat muted");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update notifications"));
    }
  };

  const clearThisChat = async () => {
    if (!roomId) return;
    try {
      const updated = await roomsApi.clearChat(roomId);
      setPrefs(updated);
      setMessages([]);
      setCallLogs([]);
      setPinnedMessages([]);
      toast.success("Chat cleared");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't clear this chat"));
    }
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

  // Sends one locally-shown message to the server. Success: swap in the saved copy. Network failure: keep it on
  // screen marked "Not sent" with Retry. A refusal from the server (blocked, suspended...): say why and remove it.
  const deliverLocal = async (localMsg: MessageWithProfile) => {
    if (!roomId || !localMsg.local) return;
    const { clientId } = localMsg.local;
    try {
      const sent = await messagesApi.sendMessage(roomId, {
        type: localMsg.type as Message["type"],
        content: localMsg.type === "text" ? localMsg.content ?? undefined : undefined,
        media_url: localMsg.media_url || undefined,
        duration: localMsg.duration || undefined,
        reply_to: localMsg.reply_to || undefined,
        client_id: clientId,
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev.filter((m) => m.id !== localMsg.id); // the live copy got here first
        return prev.map((m) => (m.id === localMsg.id ? { ...sent, profile: m.profile } : m));
      });
      if (localMsg.type === "text" && localMsg.content) {
        void recordFromText(localMsg.content, { sourceType: "message", sourceId: sent.id, contextId: roomId });
      }
    } catch (err) {
      console.error("Message send error:", err);
      if (axios.isAxiosError(err) && err.response) {
        toast.error(apiErrorMessage(err, "Failed to send message"));
        setMessages((prev) => prev.filter((m) => m.id !== localMsg.id));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === localMsg.id && m.local ? { ...m, local: { ...m.local, state: "failed" } } : m)));
      }
    }
  };

  const sendMessage = async (content: string, type: "text" | "image" | "audio" | "video" = "text", mediaUrl?: string, duration?: number, replyTo?: string) => {
    if (!roomId || !user) return;
    if (isMuted) { toast.error("You are muted in this room"); return; }
    if (room?.name === "📢 4GO Announcements") {
      toast.error("This is a broadcast-only channel");
      return;
    }
    const clientId = newClientId();
    const localMsg: MessageWithProfile = {
      id: `local-${clientId}`,
      room_id: roomId,
      sender_id: user.id,
      type,
      content: type === "text" ? content : null,
      media_url: mediaUrl ?? null,
      duration: duration ?? null,
      created_at: new Date().toISOString(),
      reply_to: replyTo ?? null,
      profile: ownSummaryRef.current,
      local: { state: "sending", clientId },
    } as MessageWithProfile;
    forceScrollRef.current = true;
    setMessages((prev) => [...prev, localMsg]);
    await deliverLocal(localMsg);
  };

  const retryLocal = (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg?.local) return;
    const resending = { ...msg, local: { ...msg.local, state: "sending" as const } };
    setMessages((prev) => prev.map((m) => (m.id === id ? resending : m)));
    void deliverLocal(resending);
  };

  const discardLocal = (id: string) => setMessages((prev) => prev.filter((m) => m.id !== id));

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

  // The confirmation (Delete for everyone / Delete for me / Cancel) lives in the message bubble's dialog.
  const deleteMessage = async (messageId: string, scope: "me" | "everyone") => {
    if (!user) return;
    try {
      await messagesApi.deleteMessage(messageId, scope);
      if (scope === "me") {
        setMessages((c) => c.filter((m) => m.id !== messageId));
      } else {
        const deletedAt = new Date().toISOString();
        setMessages((c) => c.map((m) => (m.id === messageId ? { ...m, deleted_at: deletedAt, content: null, media_url: null, duration: null, edited_at: null } : m)));
        setPinnedMessages((c) => c.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete message"));
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
    if (msg.deleted_at) return; // can't reply to a message that was deleted for everyone
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
              content: original.deleted_at ? null : original.content,
              senderName: original.profile?.display_name || original.profile?.username || "User",
              senderId: original.sender_id,
              type: original.deleted_at ? "deleted" : original.type,
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
                  content: original.deleted_at ? null : original.content,
                  senderName: prof?.display_name || prof?.username || "User",
                  senderId: original.sender_id,
                  type: original.deleted_at ? "deleted" : original.type,
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
  const typingText =
    typingUsers.length === 0
      ? null
      : room?.type === "dm"
      ? "typing…"
      : typingUsers.length === 1
      ? `${typingUsers[0].displayName} is typing…`
      : `${typingUsers[0].displayName} and ${typingUsers.length - 1} other${typingUsers.length > 2 ? "s" : ""} are typing…`;
  const roomSubtitle = typingText
    ? typingText
    : room?.type === "dm"
    ? formatLastSeen(dmPeer?.is_online, dmPeer?.last_seen)
    : `${memberCount} members · ${onlineCount} online`;
  const conversationItems: Array<
    | { kind: "message"; created_at: string; item: MessageWithProfile }
    | { kind: "call_log"; created_at: string; item: CallLog }
  > = [
    ...messages.map((message) => ({ kind: "message" as const, created_at: message.created_at, item: message })),
    ...(room?.type === "dm"
      ? callLogs
          .filter((callLog) => !prefs?.cleared_at || new Date(callLog.created_at).getTime() > new Date(prefs.cleared_at).getTime())
          .map((callLog) => ({ kind: "call_log" as const, created_at: callLog.created_at, item: callLog }))
      : []),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Opened from a missed-call notification's "Call back" button: start that kind of call once, then drop the parameter.
  useEffect(() => {
    const wanted = searchParams.get("callback");
    if (!wanted || room?.type !== "dm" || !dmPeer || !roomId) return;
    const type = wanted === "video" ? "video" : "voice";
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("callback"); return next; }, { replace: true });
    if ((type === "video" && !canVideoCall) || (type === "voice" && !canVoiceCall)) { toast.error(`Your rank doesn't allow ${type} calls yet.`); return; }
    void call.startCall(roomId, dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User", type, dmPeer.avatar_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, room?.type, dmPeer?.user_id, roomId]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <AclibBanner />
      <AdSlot placement="room" />
      <div className="gradient-primary px-2 pt-10 pb-2 flex items-center gap-1 shrink-0 shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-0.5 pl-1 pr-0.5 py-1 text-primary-foreground rounded-full active:bg-white/10" aria-label="Back"><ArrowLeft className="w-6 h-6" /></button>
        <button onClick={() => room?.type !== "dm" && navigate(`/room/${roomId}/members`)} className="flex min-w-0 flex-1 items-center gap-3 text-left py-1">
          {room?.type === "dm" ? <UserAvatar name={dmPeer?.display_name || dmPeer?.username} url={dmPeer?.avatar_url} size="md" /> : <UserAvatar name={room?.name} url={(room as { avatar_url?: string | null } | null)?.avatar_url} size="md" />}
          <div className="min-w-0">
            <h1 className="text-[16px] leading-tight font-display font-semibold text-primary-foreground truncate flex items-center gap-1.5"><span className="truncate">{roomTitle}</span>{chatMuted && <BellOff className="w-3.5 h-3.5 shrink-0 opacity-80" aria-label="Muted" />}</h1>
            <p className={`text-[12.5px] leading-tight truncate ${typingText ? "text-primary-foreground font-medium" : "text-primary-foreground/75"}`}>{roomSubtitle}</p>
          </div>
        </button>

        {room?.type === "dm" && dmPeer && (
          <div className="flex">
            {canVideoCall && <button onClick={() => call.startCall(roomId || "", dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User", "video", dmPeer.avatar_url)} className="p-2.5 text-primary-foreground/90 hover:text-primary-foreground rounded-full active:bg-white/10" title="Video call" aria-label="Video call"><Video className="w-5 h-5" /></button>}
            {canVoiceCall && <button onClick={() => call.startCall(roomId || "", dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User", "voice", dmPeer.avatar_url)} className="p-2.5 text-primary-foreground/90 hover:text-primary-foreground rounded-full active:bg-white/10" title="Voice call" aria-label="Voice call"><Phone className="w-5 h-5" /></button>}
          </div>
        )}

        {pinnedMessages.length > 0 && (
          <button onClick={() => setShowPinned(!showPinned)} className="p-2.5 text-primary-foreground/90 relative" aria-label="Pinned messages">
            <Pin className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[9px] text-destructive-foreground flex items-center justify-center font-bold">{pinnedMessages.length}</span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="p-2.5 text-primary-foreground/90 rounded-full active:bg-white/10" aria-label="More options"><MoreVertical className="w-5 h-5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {room?.type !== "dm" && <DropdownMenuItem onClick={() => navigate(`/room/${roomId}/members`)}><Users className="mr-2 h-4 w-4" />Group info &amp; members</DropdownMenuItem>}
            {room?.type === "dm" && dmPeer && <DropdownMenuItem onClick={() => void handleBlockUser(dmPeer.user_id, dmPeer.display_name || dmPeer.username || "User")}><ShieldBan className="mr-2 h-4 w-4" />Block user</DropdownMenuItem>}
            {chatMuted ? (
              <DropdownMenuItem onClick={() => void setMute("off")}><Bell className="mr-2 h-4 w-4" />Unmute notifications</DropdownMenuItem>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><BellOff className="mr-2 h-4 w-4" />Mute notifications</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => void setMute("8h")}>8 hours</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void setMute("1w")}>1 week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void setMute("forever")}>Always</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={() => window.setTimeout(() => setClearOpen(true), 0)}><Eraser className="mr-2 h-4 w-4" />Clear chat</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setReportTarget({ type: "room" })}><Flag className="mr-2 h-4 w-4" />{room?.type === "dm" ? "Report" : "Report room"}</DropdownMenuItem>
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
      <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-[6%] py-3 chat-wallpaper"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < 100) void loadOlderMessages();
          const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          const away = fromBottom > 300;
          setShowScrollDown((prev) => (prev === away ? prev : away));
          if (fromBottom < 150) setAwayUnread((n) => (n === 0 ? n : 0));
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

              if (entry.item.sender_id === user?.id && !entry.item.local) {
                if (room?.type === "dm") {
                  const sentAt = new Date(entry.created_at).getTime();
                  if (peerLastReadAt && sentAt <= new Date(peerLastReadAt).getTime()) status = "read";
                  else if (peerDeliveredAt && sentAt <= new Date(peerDeliveredAt).getTime()) status = "delivered";
                  else status = "sent";
                } else {
                  status = "sent"; // per-member delivery isn't tracked for group rooms
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
                      onForward={(m) => setForwardMessage(m as MessageWithProfile)}
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
                      showSenderName={room?.type !== "dm"}
                      showAvatar={room?.type !== "dm"}
                      showVideoAds={room?.type !== "dm"}
                      localState={entry.item.local?.state}
                      onRetry={() => retryLocal(entry.item.id)}
                      onDiscard={() => discardLocal(entry.item.id)}
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

      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          aria-label={awayUnread > 0 ? `Scroll to bottom, ${awayUnread} new messages` : "Scroll to bottom"}
          className="absolute bottom-3 right-3 sm:right-[6%] z-20 h-10 w-10 rounded-full bg-card text-muted-foreground shadow-lg border border-border flex items-center justify-center animate-fade-in active:scale-95 transition-transform"
        >
          <ChevronDown className="w-6 h-6" />
          {awayUnread > 0 && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
              {awayUnread > 99 ? "99+" : awayUnread}
            </span>
          )}
        </button>
      )}
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this chat?</AlertDialogTitle>
            <AlertDialogDescription>All messages and calls here will be removed from your view. {room?.type === "dm" ? "The other person keeps their copy." : "Other members aren't affected."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void clearThisChat()}>Clear chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ForwardDialog open={!!forwardMessage} onOpenChange={(o) => !o && setForwardMessage(null)} message={forwardMessage} />

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
