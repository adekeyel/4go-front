import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import UserAvatar from "@/components/UserAvatar";

import ReportDialog from "@/components/ReportDialog";
import { useCallContext } from "@/contexts/CallContext";
import { ArrowLeft, Flag, Phone, Video, ShieldBan, Users, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
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

const VOICE_RANKS = ["Novice", "Learner", "Professional", "Expert", "Master"];
const VIDEO_RANKS = ["Professional", "Expert", "Master"];
const VIDEO_UPLOAD_RANKS = ["Professional", "Expert", "Master"];

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetMessageId = searchParams.get("messageId");
  const handledMessageIdRef = useRef<string | null>(null);
  const { user, profile } = useAuth();
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

  const userRank = (profile as any)?.rank || "Amateur";
  const canVoiceCall = VOICE_RANKS.includes(userRank);
  const canVideoCall = VIDEO_RANKS.includes(userRank);
  const canUploadVideo = VIDEO_UPLOAD_RANKS.includes(userRank);

  const call = useCallContext();
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

      // 1. Fetch the ORIGINAL last_read_at before marking as read
      const { data: readData } = await supabase
        .from("room_reads")
        .select("last_read_at")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      const originalLastRead = (readData as any)?.last_read_at || null;
      if (!isActive) return;

      savedLastReadRef.current = originalLastRead;
      setLastReadAt(originalLastRead);

      // 2. Now mark as read
      await supabase.from("room_reads").upsert(
        { room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() } as any,
        { onConflict: "room_id,user_id" }
      );

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
        supabase.from("room_reads").upsert(
          { room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() } as any,
          { onConflict: "room_id,user_id" }
        ).then(() => refetchUnreads());
      }
    };
  }, [roomId, setCurrentRoom, user, refetchUnreads]);

  useEffect(() => {
    if (!roomId || !user) return;
    void fetchRoom();
    void checkMembership();
    void fetchPinnedMessages();
    void fetchCallLogs();

    const refreshInterval = window.setInterval(() => void fetchRoom(), 30000);

    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          const { data: p } = await supabase.from("profiles").select("user_id, display_name, avatar_url, username, rank, is_online, last_seen").eq("user_id", newMsg.sender_id).single();
          setMessages((prev) => [...prev, { ...newMsg, profile: p || undefined }]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const u = payload.new as Message;
          setMessages((prev) => prev.map((m) => m.id === u.id ? { ...m, ...u } : m));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const d = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== d.id));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_logs", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const log = payload.new as CallLog;
          setCallLogs((prev) => [...prev, log].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_logs", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const log = payload.new as CallLog;
          setCallLogs((prev) => prev.map((item) => item.id === log.id ? log : item));
        })
      .subscribe();

    return () => { window.clearInterval(refreshInterval); supabase.removeChannel(channel); };
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId || !user || readyReadRoomId !== roomId) return;
    void fetchMessages();
  }, [roomId, user, readyReadRoomId]);

  // Deeplink: scroll to specific message id from ?messageId= (e.g. mention notifications)
  useEffect(() => {
    if (!targetMessageId || messages.length === 0) return;
    if (handledMessageIdRef.current === targetMessageId) return;
    const tryScroll = async () => {
      let exists = messages.some((m) => m.id === targetMessageId);
      // If not yet loaded (older), fetch from this message forward and replace list
      if (!exists && roomId) {
        const { data: target } = await supabase
          .from("messages")
          .select("created_at")
          .eq("id", targetMessageId)
          .maybeSingle();
        if (target?.created_at) {
          const { data: range } = await supabase
            .from("messages")
            .select("*")
            .eq("room_id", roomId)
            .gte("created_at", target.created_at)
            .order("created_at", { ascending: true })
            .limit(50);
          if (range && range.length) {
            setMessages(await attachProfiles(range));
            setHasMore(true);
            exists = true;
          }
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
    const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    setRoom(data);
    const { data: members, count } = await supabase.from("room_members").select("user_id, role", { count: "exact" }).eq("room_id", roomId);
    setMemberCount(count || 0);
    if (!members || members.length === 0) { setOnlineCount(0); setDmPeer(null); return; }

    const myMembership = members.find((m) => m.user_id === user.id);
    setIsAdmin(myMembership?.role === "admin");

    const memberIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, username, rank, is_online, last_seen").in("user_id", memberIds);
    setOnlineCount(profiles?.filter((p) => p.is_online).length || 0);
    if (data?.type === "dm") setDmPeer((profiles || []).find((p) => p.user_id !== user.id) || null);

    // Check mute status
    const { data: muteData } = await supabase.from("muted_members").select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    setIsMuted(!!muteData);
  };

  const checkMembership = async () => {
    if (!roomId || !user) return;
    const { data } = await supabase.from("room_members").select("id, role").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    setIsMember(!!data);
    setIsAdmin(data?.role === "admin");

    if (!data) {
      const { data: req } = await supabase.from("room_join_requests").select("status").eq("room_id", roomId).eq("user_id", user.id).maybeSingle() as any;
      setJoinRequestStatus(req?.status || null);
    }
  };

  const fetchPinnedMessages = async () => {
    if (!roomId) return;
    const { data: pins } = await supabase.from("pinned_messages").select("message_id").eq("room_id", roomId);
    if (!pins || pins.length === 0) { setPinnedMessages([]); return; }
    const msgIds = pins.map((p: any) => p.message_id);
    const { data: msgs } = await supabase.from("messages").select("*").in("id", msgIds);
    if (msgs && msgs.length > 0) {
      const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, username, rank").in("user_id", senderIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      setPinnedMessages(msgs.map((m) => ({ ...m, profile: profileMap.get(m.sender_id) || undefined })));
    }
  };

  const fetchCallLogs = async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from("call_logs")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    setCallLogs(data || []);
  };

  const joinRoom = async () => {
    if (!roomId || !user || !room) return;

    if (room.type === "private") {
      const fee = (room as any).join_fee || 0;
      const questions: string[] = (room as any).join_questions || [];

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

      // Deduct fee immediately
      if (fee > 0) {
        const coins = (profile as any)?.coins || 0;
        if (coins < fee) {
          toast.error(`Not enough coins. You need ${fee} coins to request.`);
          return;
        }
        const { error: deductErr } = await supabase.from("profiles").update({ coins: coins - fee } as any).eq("user_id", user.id);
        if (deductErr) { toast.error("Couldn't deduct fee"); return; }
      }

      const { error } = await supabase.from("room_join_requests").insert({
        room_id: roomId,
        user_id: user.id,
        fee_paid: fee,
        answers: questions.length > 0 ? joinAnswers : null,
      } as any);
      if (error) {
        // Refund on failure
        if (fee > 0) {
          const coins = (profile as any)?.coins || 0;
          await supabase.from("profiles").update({ coins: coins + fee } as any).eq("user_id", user.id);
        }
        if (error.code === "23505") toast.info("Join request already sent");
        else toast.error("Couldn't send join request");
      } else {
        setJoinRequestStatus("pending");
        setShowJoinForm(false);
        toast.success(fee > 0 ? `Request sent! ${fee} coins deducted. 🙏` : "Join request sent! Waiting for admin approval. 🙏");
      }
      return;
    }

    const { error } = await supabase.from("room_members").insert({ room_id: roomId, user_id: user.id });
    if (error) { toast.error("Couldn't join room"); } else { setIsMember(true); setMemberCount((c) => c + 1); toast.success("Joined! 🎉"); fetchMessages(); }
  };

  const PAGE_SIZE = 50;

  const attachProfiles = async (msgs: Message[]): Promise<MessageWithProfile[]> => {
    if (msgs.length === 0) return [];
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, username, rank, is_online, last_seen, is_monetized").in("user_id", senderIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
    return msgs.map((m) => ({ ...m, profile: profileMap.get(m.sender_id) || undefined }));
  };

  const fetchMessages = async () => {
    if (!roomId || !user) return;
    isInitialLoad.current = true;

    // Use the saved last_read_at from before we marked as read
    const userLastRead = savedLastReadRef.current;

    if (userLastRead) {
      const { data: firstUnread } = await supabase
        .from("messages")
        .select("id, created_at")
        .eq("room_id", roomId)
        .gt("created_at", userLastRead)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const firstUnreadMessage = Array.isArray(firstUnread)
        ? firstUnread[0]
        : firstUnread;

      if (firstUnreadMessage?.created_at) {
        const [{ data: unreadMessages }, { count: olderCount }] = await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("room_id", roomId)
            .gte("created_at", firstUnreadMessage.created_at)
            .order("created_at", { ascending: true }),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("room_id", roomId)
            .lt("created_at", firstUnreadMessage.created_at),
        ]);

        setHasMore((olderCount || 0) > 0);
        setMessages(await attachProfiles(unreadMessages || []));
        return;
      }
    }

    // Default: load latest PAGE_SIZE messages
    const { data } = await supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1);
    if (data && data.length > 0) {
      const reversed = data.reverse();
      setHasMore(data.length === PAGE_SIZE);
      setMessages(await attachProfiles(reversed));
    } else {
      setMessages([]);
      setHasMore(false);
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldestTimestamp = messages[0].created_at;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .lt("created_at", oldestTimestamp)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (data && data.length > 0) {
      const reversed = data.reverse();
      const withProfiles = await attachProfiles(reversed);
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
    const insertData: any = {
      room_id: roomId,
      sender_id: user.id,
      type,
      content: type === "text" ? content : null,
      media_url: mediaUrl || null,
      duration: duration || null,
    };
    if (replyTo) insertData.reply_to = replyTo;
    const { data: inserted, error } = await supabase.from("messages").insert(insertData).select("id").maybeSingle();
    if (error) {
      console.error("Message insert error:", error);
      toast.error("Failed to send message: " + error.message);
      return;
    }
    if (type === "text" && content && inserted?.id) {
      const { extractMentionHandles } = await import("@/lib/mentions");
      const handles = extractMentionHandles(content);
      if (handles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("username", handles);
        const ids = (profiles || []).map((p: any) => p.user_id).filter((id: string) => id && id !== user.id);
        if (ids.length > 0) {
          await supabase.rpc("record_mentions", {
            p_mentioner_id: user.id,
            p_mentioned_ids: ids,
            p_source_type: "message",
            p_source_id: inserted.id,
            p_context_id: roomId,
            p_preview: content.slice(0, 200),
          });
        }
      }
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("messages").update({ content, edited_at: now } as any).eq("id", messageId).eq("sender_id", user.id);
    if (error) { toast.error("Couldn't edit message"); return; }
    setMessages((c) => c.map((m) => m.id === messageId ? { ...m, content, edited_at: now } : m));
    toast.success("Message updated");
  };

  const deleteMessage = async (messageId: string) => {
    if (!user || !window.confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", user.id);
    if (error) { toast.error("Couldn't delete message"); return; }
    setMessages((c) => c.filter((m) => m.id !== messageId));
    toast.success("Message deleted");
  };

  const handlePinMessage = async (messageId: string) => {
    if (!roomId || !user) return;
    const existing = pinnedMessages.find((m) => m.id === messageId);
    if (existing) {
      await supabase.from("pinned_messages").delete().eq("room_id", roomId).eq("message_id", messageId);
      setPinnedMessages((c) => c.filter((m) => m.id !== messageId));
      toast.success("Message unpinned");
    } else {
      const { error } = await supabase.from("pinned_messages").insert({ room_id: roomId, message_id: messageId, pinned_by: user.id } as any);
      if (error) { toast.error("Couldn't pin message"); return; }
      const msg = messages.find((m) => m.id === messageId);
      if (msg) setPinnedMessages((c) => [...c, msg]);
      toast.success("Message pinned");
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

  // Build a map of reply info, fetching missing originals from DB
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

      // Fetch missing reply targets from DB
      if (missingIds.length > 0) {
        const uniqueIds = [...new Set(missingIds)];
        const { data: missingMsgs } = await supabase
          .from("messages")
          .select("id, content, type, sender_id")
          .in("id", uniqueIds);
        if (missingMsgs && missingMsgs.length > 0) {
          const senderIds = [...new Set(missingMsgs.map((m) => m.sender_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, username")
            .in("user_id", senderIds);
          const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

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
  }, [messages]);

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
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < 100 && hasMore && !loadingMore) {
            loadOlderMessages();
          }
        }}
      >
        {loadingMore && (
          <div className="text-center py-2">
            <span className="text-xs text-muted-foreground">Loading older messages...</span>
          </div>
        )}
        {(() => {
          let newDividerShown = false;
          return conversationItems.map((entry) => {
            const isUnread = lastReadAt && entry.created_at > lastReadAt && (entry.kind !== "message" || entry.item.sender_id !== user?.id) && !newDividerShown;
            if (isUnread) newDividerShown = true;
            return (
              <div key={`${entry.kind}-${entry.item.id}`}>
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
          {room?.type === "private" && (room as any)?.rules && (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-semibold text-foreground mb-1">📋 Room Rules</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{(room as any).rules}</p>
            </div>
          )}
          {room?.type === "private" && ((room as any)?.join_fee || 0) > 0 && (
            <p className="text-xs text-center text-muted-foreground">Joining fee: <span className="font-bold text-primary">{(room as any).join_fee} coins</span> (deducted on request)</p>
          )}

          {/* Questions form */}
          {showJoinForm && ((room as any)?.join_questions || []).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground">📝 Answer these questions to join:</p>
              {((room as any).join_questions as string[]).map((q: string, i: number) => (
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
