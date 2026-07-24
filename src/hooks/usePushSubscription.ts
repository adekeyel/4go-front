import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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

      // Bind through the backend function so a browser endpoint can safely move
      // from an old logged-in account to the current user.
      const { error } = await supabase.functions.invoke("rotate-push-subscription", {
        body: {
          oldEndpoint: subscription.endpoint,
          endpoint: subscription.endpoint,
          p256dh,
          auth: authKey,
        },
      });

      if (error) console.error("Failed to save push subscription:", error);
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
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rotate-push-subscription`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              oldEndpoint: sub.endpoint,
              endpoint: sub.endpoint,
              p256dh: arrayBufferToBase64(p256dh),
              auth: arrayBufferToBase64(auth),
            }),
          },
        );
      } catch { /* ignore */ }
    })();
  }, [user, subscribeToPush]);

  return { subscribeToPush };
}
