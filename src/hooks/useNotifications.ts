import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/sockets/SocketContext";
import * as roomsApi from "@/api/rooms";
import * as friendsApi from "@/api/friends";
import * as profilesApi from "@/api/profiles";
import type { BannerData } from "@/components/InAppBanner";
import { SW_URL } from "@/lib/swUrl";

const SOUND_KEY = "4go-notification-sound";

interface LatestMessageSource {
  senderId: string;
  senderName: string;
  roomId: string;
  preview: string;
}

export type UnreadMap = Record<string, number>;

function createNotificationSound(): HTMLAudioElement {
  const sampleRate = 22050;
  const duration = 0.3;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.15 ? 880 : 1100;
    const envelope = Math.min(1, Math.min(t * 20, (duration - t) * 20));
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = 0.5;
  return audio;
}

// Simple in-memory cache for profiles and rooms to avoid repeated fetches
const profileCache = new Map<string, { display_name: string | null; avatar_url: string | null; ts: number }>();
const roomCache = new Map<string, { name: string; type: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedProfile(userId: string) {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;
  const [data] = await profilesApi.getProfilesByIds([userId]).catch(() => []);
  if (data) {
    const entry = { display_name: data.display_name, avatar_url: data.avatar_url, ts: Date.now() };
    profileCache.set(userId, entry);
    return entry;
  }
  return null;
}

async function getCachedRoom(roomId: string) {
  const cached = roomCache.get(roomId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;
  const data = await roomsApi.getRoom(roomId).catch(() => null);
  if (data) {
    const entry = { name: data.name, type: data.type, ts: Date.now() };
    roomCache.set(roomId, entry);
    return entry;
  }
  return null;
}

export function useNotifications() {
  const { user } = useAuth();
  const socket = useSocket();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadFriendRequests, setUnreadFriendRequests] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [latestMessageSource, setLatestMessageSource] = useState<LatestMessageSource | null>(null);
  const [pendingBanner, setPendingBanner] = useState<BannerData | null>(null);
  const [dmUnreads, setDmUnreads] = useState<UnreadMap>({});
  const currentRoomRef = useRef<string | null>(null);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") {
      setPermissionGranted(true);
      if ("serviceWorker" in navigator) {
        try { await navigator.serviceWorker.register(SW_URL); } catch { /* noop */ }
      }
      return true;
    }
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    setPermissionGranted(granted);
    return granted;
  }, []);

  const showNotification = useCallback((title: string, body: string, tag?: string) => {
    if (!permissionGranted) return;
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          const opts: NotificationOptions & { vibrate?: number[] } = {
            body,
            icon: "/icons/icon-192.png",
            tag: tag || "4go-notification",
            silent: false,
            vibrate: [200, 100, 200],
          };
          reg.showNotification(title, opts);
        });
      } else {
        new Notification(title, { body, icon: "/icons/icon-192.png", tag: tag || "4go-notification", silent: false });
      }
    } catch { /* noop */ }
  }, [permissionGranted]);

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SOUND_KEY) === "off") return;
    try {
      // Create a fresh Audio element each time to avoid browser autoplay blocks on reused elements
      const audio = createNotificationSound();
      audio.play().catch(() => {});
    } catch { /* noop */ }
  }, []);

  const setCurrentRoom = useCallback((roomId: string | null) => {
    currentRoomRef.current = roomId;
  }, []);

  const clearDmUnread = useCallback((friendId: string) => {
    setDmUnreads((prev) => {
      const next = { ...prev };
      delete next[friendId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    requestPermission();

    // Fetch pending friend requests count once
    friendsApi
      .listFriendRequests()
      .then((reqs) => setUnreadFriendRequests(reqs.length))
      .catch(() => {});
  }, [user, requestPermission]);

  useEffect(() => {
    if (!user || !socket) return;

    // The backend only sends "message:notify" to members of the room, so no
    // client-side membership check is needed.
    const onMessage = async (msg: { roomId: string; messageId: string; senderId: string; type: string; content: string | null }) => {
      if (msg.senderId === user.id) return;
      if (currentRoomRef.current === msg.roomId) return;

      setUnreadMessages((prev) => prev + 1);

      const [sender, roomData] = await Promise.all([getCachedProfile(msg.senderId), getCachedRoom(msg.roomId)]);

      const senderName = sender?.display_name || "Someone";
      const body = msg.type === "image" ? "📷 Sent a photo" : msg.type === "audio" ? "🎤 Sent a voice note" : msg.content || "New message";

      setLatestMessageSource({ senderId: msg.senderId, senderName, roomId: msg.roomId, preview: body });

      if (roomData?.type === "dm") {
        setDmUnreads((prev) => ({ ...prev, [msg.senderId]: (prev[msg.senderId] || 0) + 1 }));
      }

      playNotificationSound();

      const title = `${senderName}${roomData?.type === "dm" ? "" : ` in ${roomData?.name || "room"}`}`;
      setPendingBanner({
        id: msg.messageId,
        title,
        body,
        avatarUrl: sender?.avatar_url,
        avatarName: senderName,
        navigateTo: `/room/${msg.roomId}`,
      });

      showNotification(title, body, `msg-${msg.messageId}`);
    };

    const onFriendRequest = async (req: { requestId: string; from: string }) => {
      setUnreadFriendRequests((prev) => prev + 1);

      const requester = await getCachedProfile(req.from);
      const name = requester?.display_name || "Someone";
      playNotificationSound();

      setPendingBanner({
        id: req.requestId,
        title: "Friend Request",
        body: `${name} wants to be your friend!`,
        avatarUrl: requester?.avatar_url,
        avatarName: name,
        navigateTo: "/friend-requests",
      });

      showNotification("Friend Request", `${name} wants to be your friend!`, `friend-${req.requestId}`);
    };

    socket.on("message:notify", onMessage);
    socket.on("friend:request", onFriendRequest);
    return () => {
      socket.off("message:notify", onMessage);
      socket.off("friend:request", onFriendRequest);
    };
  }, [user, socket, showNotification, playNotificationSound]);

  const clearUnreadMessages = useCallback(() => setUnreadMessages(0), []);
  const clearUnreadFriendRequests = useCallback(() => setUnreadFriendRequests(0), []);
  const clearLatestMessageSource = useCallback(() => setLatestMessageSource(null), []);
  const dismissBanner = useCallback(() => setPendingBanner(null), []);

  return {
    unreadMessages,
    unreadFriendRequests,
    totalUnread: unreadMessages + unreadFriendRequests,
    latestMessageSource,
    pendingBanner,
    dmUnreads,
    clearUnreadMessages,
    clearUnreadFriendRequests,
    clearLatestMessageSource,
    clearDmUnread,
    dismissBanner,
    setCurrentRoom,
    requestPermission,
    permissionGranted,
  };
}
