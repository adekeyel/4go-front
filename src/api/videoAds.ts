import axios from "axios";
import { apiClient } from "@/lib/apiClient";
import type { VideoAd, VideoAdInput } from "@/lib/videoAds";

export interface AdUploadResult {
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number | null;
}
export interface PageOption { id: string; name: string; profile_image: string | null; followers_count: number }
export interface AdvertiserOption { id: string; name: string }

/** Readable message from a failed API call (the backend sends { error }). */
export function apiErrorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (e.code === "ECONNABORTED") return "The request timed out";
    if (!e.response) return "Couldn't reach the server";
  }
  return e instanceof Error ? e.message : fallback;
}

export const listVideoAds = async () => (await apiClient.get<VideoAd[]>("/video-ads/admin/ads")).data;
export const createVideoAd = async (body: VideoAdInput) => (await apiClient.post<VideoAd>("/video-ads/admin/ads", body)).data;
export const updateVideoAd = async (id: string, body: Partial<VideoAdInput>) =>
  (await apiClient.patch<VideoAd>(`/video-ads/admin/ads/${id}`, body)).data;
export const deleteVideoAd = async (id: string) => { await apiClient.delete(`/video-ads/admin/ads/${id}`); };

export const listAdvertisers = async () => (await apiClient.get<AdvertiserOption[]>("/ads/admin/advertisers")).data;
export const searchPages = async (q: string) => (await apiClient.get<PageOption[]>("/video-ads/admin/pages", { params: { q } })).data;
export const getPagesByIds = async (ids: string[]) =>
  ids.length === 0 ? [] : (await apiClient.get<PageOption[]>("/video-ads/admin/pages", { params: { ids: ids.join(",") } })).data;

/** Upload the ad video. The shared client's 20s timeout would cut off a big file, so this call has its own. */
export async function uploadAdVideo(file: File, onProgress?: (percent: number) => void): Promise<AdUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<AdUploadResult>("/video-ads/admin/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 10 * 60 * 1000,
    onUploadProgress: (e) => { if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100)); },
  });
  return data;
}
