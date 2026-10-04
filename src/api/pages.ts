import { apiClient } from "@/lib/apiClient";
import type { PagePostCardData } from "@/components/pages/PagePostCard";

export interface PageRow {
  id: string;
  owner_id: string;
  name: string;
  about: string | null;
  category: string | null;
  profile_image: string | null;
  cover_image: string | null;
  followers_count: number;
  is_monetized: boolean;
  created_at?: string;
  is_followed?: boolean;
}

/**
 * Page posts come back either flat (the feed: page_name / page_avatar) or with a nested `page` card
 * (everything else). The cards read the flat form, so normalise here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPagePost(row: any): PagePostCardData {
  const { page, ...rest } = row;
  return {
    ...rest,
    page_name: rest.page_name ?? page?.name ?? null,
    page_avatar: rest.page_avatar ?? page?.profile_image ?? null,
    is_followed: !!rest.is_followed,
    is_boosted: !!rest.is_boosted,
    is_saved: !!rest.is_saved,
    is_liked: !!rest.is_liked,
  };
}

// --- Posts ---

export async function listPageFeed(limit: number, offset: number): Promise<PagePostCardData[]> {
  const { data } = await apiClient.get("/pages/feed", { params: { limit, offset } });
  return (data as unknown[]).map(toPagePost);
}

export async function getPagePost(postId: string): Promise<PagePostCardData> {
  const { data } = await apiClient.get(`/pages/posts/${postId}`);
  return toPagePost(data);
}

export async function listPagePosts(pageId: string, limit = 50): Promise<PagePostCardData[]> {
  const { data } = await apiClient.get(`/pages/${pageId}/posts`, { params: { limit } });
  return (data as unknown[]).map(toPagePost);
}

export async function listSavedPagePosts(): Promise<PagePostCardData[]> {
  const { data } = await apiClient.get("/pages/posts/saved");
  return (data as unknown[]).map(toPagePost);
}

export async function createPagePost(pageId: string, input: { content?: string | null; media_url?: string | null; media_type: "text" | "image" | "video" }): Promise<{ id: string }> {
  const { data } = await apiClient.post(`/pages/${pageId}/posts`, {
    media_type: input.media_type,
    ...(input.content ? { content: input.content } : {}),
    ...(input.media_url ? { media_url: input.media_url } : {}),
  });
  return data;
}

export async function togglePagePostLike(postId: string): Promise<{ liked: boolean }> {
  const { data } = await apiClient.post(`/pages/posts/${postId}/like`);
  return data;
}

export async function togglePagePostSave(postId: string): Promise<{ saved: boolean }> {
  const { data } = await apiClient.post(`/pages/posts/${postId}/save`);
  return data;
}

/** Counts a view once per person. Safe to call repeatedly. */
export async function recordPagePostView(postId: string) {
  const { data } = await apiClient.post(`/pages/posts/${postId}/view`);
  return data as { recorded?: boolean; unique_views?: number; self_view?: boolean; already_viewed?: boolean };
}

export async function forwardPagePost(postId: string, roomId: string, note?: string) {
  const { data } = await apiClient.post(`/pages/posts/${postId}/forward`, { room_id: roomId, ...(note ? { note } : {}) });
  return data;
}

// --- Boosts ---

export async function boostPagePost(postId: string, plan: string) {
  const { data } = await apiClient.post(`/pages/posts/${postId}/boost`, { plan });
  return data;
}

export interface BoostRow {
  id: string;
  post_id: string;
  plan: string;
  coins_spent: number;
  reach_target: number;
  reach_count: number;
  ends_at: string;
  status: string;
}

export async function listPageBoosts(pageId: string): Promise<BoostRow[]> {
  const { data } = await apiClient.get(`/pages/${pageId}/boosts`);
  return data;
}

// --- Pages ---

/** Most-followed first. */
export async function listPages(params: { q?: string; owner?: "me"; limit?: number; offset?: number } = {}): Promise<PageRow[]> {
  const { data } = await apiClient.get("/pages", { params });
  return data;
}

export async function listFollowingPages(): Promise<PageRow[]> {
  const { data } = await apiClient.get("/pages/following");
  return data;
}

export async function getPage(pageId: string): Promise<PageRow | null> {
  try {
    const { data } = await apiClient.get(`/pages/${pageId}`);
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function createPage(input: { name: string; about?: string | null; category?: string | null; profile_image?: string | null; cover_image?: string | null }): Promise<PageRow> {
  const { data } = await apiClient.post("/pages", input);
  return data;
}

export async function followPage(pageId: string) {
  await apiClient.post(`/pages/${pageId}/follow`);
}

export async function unfollowPage(pageId: string) {
  await apiClient.delete(`/pages/${pageId}/follow`);
}

export async function listFollowers(pageId: string): Promise<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]> {
  const { data } = await apiClient.get(`/pages/${pageId}/followers`);
  return data;
}

/** Pages that this page's owner follows. */
export async function listOwnerFollowing(pageId: string): Promise<{ id: string; name: string; profile_image: string | null; category: string | null }[]> {
  const { data } = await apiClient.get(`/pages/${pageId}/owner-following`);
  return data;
}
