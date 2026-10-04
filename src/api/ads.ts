import { apiClient } from "@/lib/apiClient";

export interface AdBannerPublic {
  id: string;
  image_url: string;
  target_url: string;
  placements: string[];
  position: string;
}

/** Active banners for a placement (and optionally a position). Public: no login needed. */
export async function listBanners(placement: string, position?: string): Promise<AdBannerPublic[]> {
  const { data } = await apiClient.get("/ads", { params: { placement, ...(position ? { position } : {}) } });
  return data;
}

/** Count an impression or click. Best effort: never throws. */
export async function trackAdEvent(bannerId: string, event: "impression" | "click") {
  try {
    await apiClient.post(`/ads/${bannerId}/events`, { event });
  } catch {
    /* tracking must never break the page */
  }
}
