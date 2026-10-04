import { apiClient } from "@/lib/apiClient";

export interface ContactMatch {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  contact_name: string | null;
  is_friend: boolean;
  has_pending_request: boolean;
}

/** Upload hashed contacts (SHA-256 of digits-only phone numbers; raw numbers never leave the device). */
export async function syncContacts(contacts: { phone_hash: string; name?: string | null }[], replace = true) {
  const { data } = await apiClient.put("/contacts", { contacts, replace });
  return data as { received: number; added: number };
}

export async function clearContacts() {
  await apiClient.delete("/contacts");
}

export async function findContactMatches(limit = 50, offset = 0): Promise<ContactMatch[]> {
  const { data } = await apiClient.get("/contacts/matches", { params: { limit, offset } });
  return data;
}
