import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export async function getMyProfile(): Promise<Profile> {
  const { data } = await apiClient.get("/profiles/me");
  return data;
}

export async function updateMyProfile(input: Partial<{
  username: string;
  display_name: string;
  bio: string;
  interests: string[];
  avatar_url: string;
  phone_number: string;
}>): Promise<Profile> {
  const { data } = await apiClient.patch("/profiles/me", input);
  return data;
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data } = await apiClient.get(`/profiles/${userId}`);
  return data;
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return [];
  const { data } = await apiClient.get("/profiles", { params: { ids: ids.join(",") } });
  return data;
}

export async function searchProfiles(q: string): Promise<Profile[]> {
  const { data } = await apiClient.get("/profiles", { params: { q } });
  return data;
}

export async function getAdminAccess(): Promise<boolean> {
  const { data } = await apiClient.get("/profiles/me/admin-access");
  return !!data.isAdmin;
}
