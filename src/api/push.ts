import { apiClient } from "@/lib/apiClient";

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const { data } = await apiClient.get<{ publicKey?: string }>("/push/vapid-public-key");
    return data?.publicKey || null;
  } catch {
    return null;
  }
}

/** Register (or move) this browser's push endpoint to the signed-in user. */
export async function subscribePush(input: { endpoint: string; p256dh: string; auth: string }) {
  await apiClient.post("/push/subscribe", input);
}

export async function unsubscribePush(endpoint: string) {
  await apiClient.post("/push/unsubscribe", { endpoint });
}
