import { apiClient } from "@/lib/apiClient";
import type { Tables } from "@/types/database";

export type Room = Tables<"rooms">;
export type Profile = Tables<"profiles">;
export type RoomRead = Tables<"room_reads">;

export async function listPublicRooms(): Promise<Room[]> {
  const { data } = await apiClient.get("/rooms");
  return data;
}

/** Trending/search across public+private rooms, with live member counts. */
export async function browseRooms(opts: { types?: ("public" | "private")[]; q?: string } = {}): Promise<(Room & { member_count: number })[]> {
  const { data } = await apiClient.get("/rooms", {
    params: {
      type: (opts.types ?? ["public"]).join(","),
      q: opts.q || undefined,
    },
  });
  return data;
}

export async function listMyRooms(): Promise<Room[]> {
  const { data } = await apiClient.get("/rooms/mine");
  return data;
}

export async function getRoom(roomId: string): Promise<Room> {
  const { data } = await apiClient.get(`/rooms/${roomId}`);
  return data;
}

export async function updateRoom(roomId: string, input: Partial<{
  name: string;
  description: string;
  rules: string;
  join_fee: number;
  join_questions: string[];
}>): Promise<Room> {
  const { data } = await apiClient.patch(`/rooms/${roomId}`, input);
  return data;
}

export async function listJoinRequests(roomId: string) {
  const { data } = await apiClient.get(`/rooms/${roomId}/join-requests`);
  return data;
}

export async function reviewJoinRequest(roomId: string, requestId: string, decision: "approve" | "reject") {
  const { data } = await apiClient.patch(`/rooms/${roomId}/join-requests/${requestId}`, { decision });
  return data;
}

export async function createRoom(input: {
  name: string;
  description?: string;
  type?: "public" | "private";
  rules?: string;
  join_fee?: number;
  join_questions?: string[];
}): Promise<Room> {
  const { data } = await apiClient.post("/rooms", input);
  return data;
}

export async function joinRoom(roomId: string) {
  const { data } = await apiClient.post(`/rooms/${roomId}/join`);
  return data;
}

export async function leaveRoom(roomId: string) {
  await apiClient.post(`/rooms/${roomId}/leave`);
}

/** Gets the existing 1:1 room with this user, or creates one. */
export async function getOrCreateDmRoom(userId: string): Promise<Room> {
  const { data } = await apiClient.post<Room>(`/rooms/dm/${userId}`);
  return data;
}

export async function listRoomMembers(roomId: string): Promise<(Tables<"room_members"> & { profile: Profile })[]> {
  const { data } = await apiClient.get(`/rooms/${roomId}/members`);
  return data;
}

export interface RoomMeStatus {
  isMember: boolean;
  role: string | null;
  isMuted: boolean;
  joinRequestStatus: string | null;
}

export async function getRoomMeStatus(roomId: string): Promise<RoomMeStatus> {
  const { data } = await apiClient.get(`/rooms/${roomId}/me`);
  return data;
}

export async function submitJoinRequest(roomId: string, answers?: string[]) {
  const { data } = await apiClient.post(`/rooms/${roomId}/join-requests`, { answers });
  return data;
}

export async function markRoomRead(roomId: string): Promise<RoomRead> {
  const { data } = await apiClient.post(`/rooms/${roomId}/read`);
  return data;
}

export async function listRoomReads(roomId: string): Promise<RoomRead[]> {
  const { data } = await apiClient.get(`/rooms/${roomId}/reads`);
  return data;
}

export async function listPinnedMessages(roomId: string) {
  const { data } = await apiClient.get(`/rooms/${roomId}/pinned`);
  return data;
}

export async function pinMessage(roomId: string, messageId: string) {
  const { data } = await apiClient.post(`/rooms/${roomId}/pinned/${messageId}`);
  return data;
}

export async function unpinMessage(roomId: string, messageId: string) {
  await apiClient.delete(`/rooms/${roomId}/pinned/${messageId}`);
}

export async function getUnreadCounts(): Promise<{ room_id: string; unread_count: number }[]> {
  const { data } = await apiClient.get("/rooms/unread-counts");
  return data;
}
