import { apiClient } from "./apiClient";

/** Stop push notifications to this browser for the current user (call before signing out). Never throws. */
export async function unregisterPushDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await apiClient.post("/push/unsubscribe", { endpoint: sub.endpoint });
  } catch {
    /* best effort */
  }
}
