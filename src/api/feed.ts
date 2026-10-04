import { apiClient } from "@/lib/apiClient";
import type { FeedPost } from "@/components/feed/PostCard";

/** The server nests the author as `profile`; the feed components read flat display_name/username/avatar_url/rank. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toFeedPost(row: any): FeedPost {
  const { profile, ...rest } = row;
  return {
    ...rest,
    display_name: profile?.display_name ?? null,
    username: profile?.username ?? null,
    avatar_url: profile?.avatar_url ?? null,
    rank: profile?.rank ?? null,
    is_liked: !!row.is_liked,
    feed_score: row.feed_score ?? 0,
  };
}

/** Ranked for signed-in users (limit/offset); guests get newest first. */
export async function listFeed(limit: number, offset: number): Promise<FeedPost[]> {
  const { data } = await apiClient.get("/feed", { params: { limit, offset } });
  return (data as unknown[]).map(toFeedPost);
}

export async function getPost(postId: string): Promise<FeedPost> {
  const { data } = await apiClient.get(`/feed/${postId}`);
  return toFeedPost(data);
}

export async function createPost(input: { content: string; image_url?: string | null }) {
  const { data } = await apiClient.post("/feed", { content: input.content, ...(input.image_url ? { image_url: input.image_url } : {}) });
  return data as { id: string };
}

export async function updatePost(postId: string, content: string) {
  const { data } = await apiClient.patch(`/feed/${postId}`, { content });
  return data;
}

export async function deletePost(postId: string) {
  await apiClient.delete(`/feed/${postId}`);
}

export async function togglePostLike(postId: string): Promise<{ liked: boolean }> {
  const { data } = await apiClient.post(`/feed/${postId}/like`);
  return data;
}

export async function listSavedPosts(): Promise<FeedPost[]> {
  const { data } = await apiClient.get("/feed/saved");
  return (data as unknown[]).map(toFeedPost);
}

export async function forwardPost(postId: string, roomId: string, note?: string) {
  const { data } = await apiClient.post(`/feed/${postId}/forward`, { room_id: roomId, ...(note ? { note } : {}) });
  return data;
}

// --- Comments: the same shape for user posts (/feed) and page posts (/pages/posts) ---

export interface CommentRow {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  edited_at: string | null;
  profile: { user_id: string; display_name: string | null; avatar_url: string | null; username: string | null } | null;
}

const commentBase = (postId: string, pageMode: boolean) => (pageMode ? `/pages/posts/${postId}/comments` : `/feed/${postId}/comments`);

export async function listComments(postId: string, pageMode = false): Promise<CommentRow[]> {
  const { data } = await apiClient.get(commentBase(postId, pageMode));
  return data;
}

export async function addComment(postId: string, content: string, parentId?: string | null, pageMode = false): Promise<{ id: string }> {
  const { data } = await apiClient.post(commentBase(postId, pageMode), { content, ...(parentId ? { parent_id: parentId } : {}) });
  return data;
}

export async function editComment(postId: string, commentId: string, content: string, pageMode = false) {
  const { data } = await apiClient.patch(`${commentBase(postId, pageMode)}/${commentId}`, { content });
  return data;
}

/** Also removes the comment's replies and fixes the post's comment count. */
export async function deleteComment(postId: string, commentId: string, pageMode = false): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete(`${commentBase(postId, pageMode)}/${commentId}`);
  return data;
}

/** How many posts the signed-in user has made (onboarding checklist). */
export async function getMyPostCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/feed/mine/count");
  return data?.count ?? 0;
}
