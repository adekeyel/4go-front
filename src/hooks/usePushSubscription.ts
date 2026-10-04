import { useEffect, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

// VAPID public key - safe to expose client-side
const VAPID_PUBLIC_KEY = "BCwuZJQ0w0XD7DjJsTY_dZ4HbHd8Xhgq6sSzsjrJCAZomUJx0oBsm-VZCbbLAoS61ncdUWzobQghwPRLoFgbM54";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function sameApplicationServerKey(existing: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!existing) return false;
  const current = new Uint8Array(existing);
  if (current.length !== expected.length) return false;
  return current.every((value, index) => value === expected[index]);
}

export function usePushSubscription() {
  const { user } = useAuth();

  const subscribeToPush = useCallback(async () => {
    if (!user) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      // Check existing subscription. If it was created with an old VAPID key,
      // Chrome/Android will keep returning it, but push delivery fails with 403.
      let subscription = await registration.pushManager.getSubscription();

      if (subscription && !sameApplicationServerKey(subscription.options.applicationServerKey, applicationServerKey)) {
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
      }

      if (!subscription) {
        // Request new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
      }

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!key || !auth) return;

      const p256dh = arrayBufferToBase64(key);
      const authKey = arrayBufferToBase64(auth);

      // Bind this device to the signed-in user. An endpoint belongs to one browser install, so if another
      // account used it before, the server moves it to the current user.
      await apiClient.post("/push/subscribe", { endpoint: subscription.endpoint, keys: { p256dh, auth: authKey } });
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [user]);

  useEffect(() => {
    // Skip in iframe/preview contexts.
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    if (isInIframe) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;

    // If logged in: refresh subscription row tied to this user.
    if (user) {
      subscribeToPush();
      return;
    }

    // If logged out: still keep the existing browser subscription's keys
    // alive in DB so this device keeps receiving pushes for whichever
    // user it was last bound to.
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const p256dh = sub.getKey("p256dh");
        const auth = sub.getKey("auth");
        if (!p256dh || !auth) return;
        // No login: the server finds the owner from the endpoint it already knows.
        await apiClient.post("/push/rotate", {
          oldEndpoint: sub.endpoint,
          endpoint: sub.endpoint,
          p256dh: arrayBufferToBase64(p256dh),
          auth: arrayBufferToBase64(auth),
        });
      } catch { /* ignore */ }
    })();
  }, [user, subscribeToPush]);

  return { subscribeToPush };
}
