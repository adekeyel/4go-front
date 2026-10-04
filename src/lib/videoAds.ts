// Shared by the admin screen (step 3) and, later, the video player (step 5).

export type AdPlacement = "pre_roll" | "mid_roll" | "post_roll";
export type AdStatus = "active" | "paused" | "ended";

export interface VideoAd {
  id: string;
  advertiser_id: string | null;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  target_url: string | null;
  status: AdStatus;
  placement: AdPlacement;
  mid_roll_at_seconds: number | null;
  min_video_seconds: number;
  target_page_ids: string[];
  skippable: boolean;
  skip_after_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  completions: number;
  clicks: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** What the admin can set. Matches the backend's create/patch body. */
export type VideoAdInput = Omit<
  VideoAd,
  "id" | "impressions" | "completions" | "clicks" | "created_by" | "created_at" | "updated_at"
>;

export const PLACEMENTS: { id: AdPlacement; label: string; hint: string }[] = [
  { id: "pre_roll", label: "Before video", hint: "Plays before the video starts" },
  { id: "mid_roll", label: "During video", hint: "Interrupts the video at a set time" },
  { id: "post_roll", label: "After video", hint: "Plays when the video ends" },
];

export const placementName = (p: AdPlacement) => PLACEMENTS.find((x) => x.id === p)?.label ?? p;

/** Whether the ad is actually eligible to be shown right now (status + campaign window). */
export type EffectiveStatus = "live" | "scheduled" | "expired" | "paused" | "ended";

export function effectiveStatus(ad: Pick<VideoAd, "status" | "starts_at" | "ends_at">, now = new Date()): EffectiveStatus {
  if (ad.status === "paused") return "paused";
  if (ad.status === "ended") return "ended";
  if (ad.starts_at && new Date(ad.starts_at) > now) return "scheduled";
  if (ad.ends_at && new Date(ad.ends_at) <= now) return "expired";
  return "live";
}

/** "1:05" style clock for a number of seconds. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** One-line, plain-English description of when/where an ad plays. */
export function describeRule(ad: Pick<VideoAd, "placement" | "mid_roll_at_seconds" | "min_video_seconds" | "target_page_ids">): string {
  const where =
    ad.placement === "pre_roll" ? "Before the video"
    : ad.placement === "post_roll" ? "After the video"
    : `At ${formatClock(ad.mid_roll_at_seconds)} into the video`;
  const which = `videos longer than ${ad.min_video_seconds}s`;
  const pages = ad.target_page_ids.length === 0 ? "all pages" : `${ad.target_page_ids.length} page${ad.target_page_ids.length === 1 ? "" : "s"}`;
  return `${where} · ${which} · ${pages}`;
}

/** ISO string -> value for <input type="datetime-local"> in the viewer's local time. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) -> ISO string, or null when empty/invalid. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Same cross-field rules the server enforces, so the admin gets the message before the request. */
export function validateAd(ad: Pick<VideoAdInput, "title" | "video_url" | "placement" | "mid_roll_at_seconds" | "starts_at" | "ends_at" | "min_video_seconds">): string | null {
  if (!ad.title.trim()) return "Give the ad a title";
  if (!ad.video_url) return "Upload the ad video";
  if (ad.placement === "mid_roll" && !(ad.mid_roll_at_seconds && ad.mid_roll_at_seconds > 0)) {
    return "Set the time (in seconds) the mid-roll should play at";
  }
  if (!Number.isFinite(ad.min_video_seconds) || ad.min_video_seconds < 0) return "Minimum video length can't be negative";
  if (ad.starts_at && ad.ends_at && new Date(ad.ends_at) <= new Date(ad.starts_at)) {
    return "The end date must be after the start date";
  }
  return null;
}

/** What the serve endpoint returns for one ad: only what the player needs. */
export type ServedAd = Pick<
  VideoAd,
  "id" | "video_url" | "thumbnail_url" | "duration_seconds" | "target_url" | "placement" | "mid_roll_at_seconds" | "skippable" | "skip_after_seconds"
> & {
  /** Signed by the server; presented back with every event so views/completions/clicks can't be faked. */
  token: string;
};

export type AdEventType = "impression" | "completion" | "click";

/** "62%" for part-of-whole, or "—" when there's nothing to divide by yet. */
export const percent = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
