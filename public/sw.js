// 4GO service worker — push notifications + safe network-first caching
const CACHE_NAME = "4go-cache-v4";
const ICON_CACHE = "4go-icons-v1";

// Keep in sync with src/hooks/usePushSubscription.ts
const VAPID_PUBLIC_KEY = "BCwuZJQ0w0XD7DjJsTY_dZ4HbHd8Xhgq6sSzsjrJCAZomUJx0oBsm-VZCbbLAoS61ncdUWzobQghwPRLoFgbM54";
// The API address is passed in the registration URL (/sw.js?api=...), see src/lib/swUrl.ts
const API_URL = new URL(self.location.href).searchParams.get("api") || "";
const CLOSED_CALL_TAGS = new Set();

async function closeCallNotifications(tags) {
  const notifications = await self.registration.getNotifications();
  notifications.forEach((notification) => {
    if (tags.includes(notification.tag)) notification.close();
  });
}

// Browsers require every push to show a notification; if none is shown, Chrome adds its own generic
// "this site has been updated in the background" one. For the silent "call ended" pushes we show a notification
// and take it straight back down, so nothing is left on screen.
async function showAndDismiss(tag) {
  try {
    await self.registration.showNotification("Call ended", { tag: tag + "-end", silent: true, icon: "/icons/icon-192.png" });
    const shown = await self.registration.getNotifications({ tag: tag + "-end" });
    shown.forEach((n) => n.close());
  } catch (e) {
    // best effort
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function rotateSubscription(oldEndpoint) {
  try {
    const reg = self.registration;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const p256dh = sub.getKey("p256dh");
    const auth = sub.getKey("auth");
    if (!p256dh || !auth) return;
    if (!API_URL) return;
    // No login is available in a service worker; the server works out the owner from the old endpoint.
    await fetch(`${API_URL}/api/push/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldEndpoint: oldEndpoint || undefined,
        endpoint: sub.endpoint,
        p256dh: b64(p256dh),
        auth: b64(auth),
      }),
    });
  } catch (e) {
    // best effort
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
  event.waitUntil(rotateSubscription(oldEndpoint));
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(ICON_CACHE).then((cache) =>
      cache.addAll(["/icons/icon-192.png", "/icons/icon-512.png"]).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== ICON_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CALL_STATE_CHANGED") return;
  const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
  const suppressTags = Array.isArray(data.suppressTags) ? data.suppressTags.filter(Boolean) : tags;
  suppressTags.forEach((tag) => {
    CLOSED_CALL_TAGS.add(tag);
    setTimeout(() => CLOSED_CALL_TAGS.delete(tag), 15 * 60 * 1000);
  });
  event.waitUntil(closeCallNotifications(tags));
});

// Push notifications
self.addEventListener("push", (event) => {
  let data = { title: "4GO", body: "You have a new notification" };
  try { if (event.data) data = event.data.json(); } catch {}
  const isCall = data.data && data.data.kind === "incoming_call";
  const isCallCancelled = data.data && data.data.kind === "call_cancelled";
  const isMissedCall = !!(data.data && data.data.kind === "missed_call");
  const tag = (data.data && data.data.tag) || "4go-push";
  if (isCallCancelled) {
    CLOSED_CALL_TAGS.add(tag);
    setTimeout(() => CLOSED_CALL_TAGS.delete(tag), 15 * 60 * 1000);
    event.waitUntil(closeCallNotifications([tag]).then(() => showAndDismiss(tag)));
    return;
  }
  if (isCall && CLOSED_CALL_TAGS.has(tag)) {
    event.waitUntil(closeCallNotifications([tag]).then(() => showAndDismiss(tag)));
    return;
  }
  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    vibrate: isCall ? [400, 200, 400, 200, 400, 200, 400] : [200, 100, 200],
    requireInteraction: isCall === true,
    // A newer missed-call notification from the same person replaces the old one ("3 missed calls") and still alerts.
    renotify: isCall === true || isMissedCall,
    data: data.data || {},
    actions: isCall ? [
      { action: "accept", title: "Accept" },
      { action: "decline", title: "Decline" },
    ] : isMissedCall ? [
      { action: "callback", title: "Call back" },
    ] : undefined,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let navigateTo = data.navigateTo || "/";
  if (data.kind === "incoming_call") {
    const callId = data.callId || "";
    const base = "/call/" + callId;
    if (event.action === "decline") {
      navigateTo = base + "?decline_call=1";
    } else {
      navigateTo = base + "?accept_call=1";
    }
  }
  if (data.kind === "missed_call" && event.action === "callback" && data.roomId) {
    // Opens the chat and starts the same kind of call straight away (the chat page reads ?callback=).
    navigateTo = "/room/" + data.roomId + "?callback=" + (data.callType === "video" ? "video" : "voice");
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          try { client.navigate(navigateTo); } catch {}
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(navigateTo);
    })
  );
});

// Safe fetch: network-first for everything; cache only same-origin icons/images.
// Never serve cached HTML for asset requests (prevents broken JS chunks after deploy).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Skip SW entirely for cross-origin requests (Supabase, ads, analytics, etc.)
  if (!sameOrigin) return;

  // Skip auth/api/realtime — always go to network
  if (
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/realtime/") ||
    url.pathname.startsWith("/functions/") ||
    url.pathname.startsWith("/~oauth") ||
    url.search.includes("access_token=") ||
    url.search.includes("refresh_token=") ||
    url.search.includes("type=recovery") ||
    url.search.includes("type=signup") ||
    url.search.includes("type=magiclink") ||
    url.search.includes("code=")
  ) {
    return;
  }

  // Cache-first only for icon/image assets
  const isIconOrImage =
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname);

  if (isIconOrImage) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(ICON_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => cached || Response.error());
      })
    );
    return;
  }

  // Navigations: network-first, fallback to cached index only if fully offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/", clone));
        }
        return res;
      }).catch(() => caches.match("/").then((c) => c || Response.error()))
    );
    return;
  }

  // Everything else (JS, CSS, fonts): pure network — no cache fallback.
});
