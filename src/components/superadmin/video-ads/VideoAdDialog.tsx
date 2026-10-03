import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PLACEMENTS, formatClock, isoToLocalInput, localInputToIso, validateAd,
  type AdPlacement, type AdStatus, type VideoAd, type VideoAdInput,
} from "@/lib/videoAds";
import {
  apiErrorMessage, createVideoAd, updateVideoAd, uploadAdVideo, type AdvertiserOption,
} from "@/api/videoAds";
import PagePicker from "./PagePicker";

const MAX_UPLOAD_MB = 100; // keep in step with the server limit
const NO_ADVERTISER = "none";

interface FormState {
  title: string;
  advertiser_id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  target_url: string;
  status: AdStatus;
  placement: AdPlacement;
  mid_roll_at: string;
  min_video: string;
  all_pages: boolean;
  page_ids: string[];
  skippable: boolean;
  skip_after: string;
  starts_at: string;
  ends_at: string;
}

const blank: FormState = {
  title: "", advertiser_id: NO_ADVERTISER, video_url: "", thumbnail_url: null, duration_seconds: null,
  target_url: "", status: "active", placement: "pre_roll", mid_roll_at: "", min_video: "30",
  all_pages: true, page_ids: [], skippable: true, skip_after: "5", starts_at: "", ends_at: "",
};

const fromAd = (ad: VideoAd): FormState => ({
  title: ad.title,
  advertiser_id: ad.advertiser_id ?? NO_ADVERTISER,
  video_url: ad.video_url,
  thumbnail_url: ad.thumbnail_url,
  duration_seconds: ad.duration_seconds,
  target_url: ad.target_url ?? "",
  status: ad.status,
  placement: ad.placement,
  mid_roll_at: ad.mid_roll_at_seconds != null ? String(ad.mid_roll_at_seconds) : "",
  min_video: String(ad.min_video_seconds),
  all_pages: ad.target_page_ids.length === 0,
  page_ids: ad.target_page_ids,
  skippable: ad.skippable,
  skip_after: String(ad.skip_after_seconds),
  starts_at: isoToLocalInput(ad.starts_at),
  ends_at: isoToLocalInput(ad.ends_at),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = creating a new ad */
  ad: VideoAd | null;
  advertisers: AdvertiserOption[];
  onSaved: () => void;
}

export default function VideoAdDialog({ open, onOpenChange, ad, advertisers, onSaved }: Props) {
  const [f, setF] = useState<FormState>(blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { if (open) setF(ad ? fromAd(ad) : blank); }, [open, ad]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((s) => ({ ...s, [key]: value }));

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) { toast.error("Please choose a video file"); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { toast.error(`Ad video must be under ${MAX_UPLOAD_MB}MB`); return; }
    setUploading(true); setProgress(0);
    try {
      const r = await uploadAdVideo(file, setProgress);
      setF((s) => ({
        ...s,
        video_url: r.video_url,
        thumbnail_url: r.thumbnail_url,
        duration_seconds: r.duration_seconds,
        title: s.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    // Number("") is 0, which would quietly mean "every video" - make the admin say so explicitly.
    if (f.min_video.trim() === "") { toast.error("Enter the minimum video length (use 0 for every video)"); return; }
    const midRoll = f.placement === "mid_roll" ? Math.round(Number(f.mid_roll_at)) : null;
    const minVideo = Math.round(Number(f.min_video));
    const skipAfter = Math.round(Number(f.skip_after));
    const target = f.target_url.trim();

    const payload: VideoAdInput = {
      advertiser_id: f.advertiser_id === NO_ADVERTISER ? null : f.advertiser_id,
      title: f.title.trim(),
      video_url: f.video_url,
      thumbnail_url: f.thumbnail_url,
      duration_seconds: f.duration_seconds,
      target_url: target || null,
      status: f.status,
      placement: f.placement,
      mid_roll_at_seconds: midRoll,
      min_video_seconds: minVideo,
      target_page_ids: f.all_pages ? [] : f.page_ids,
      skippable: f.skippable,
      skip_after_seconds: Number.isFinite(skipAfter) ? Math.min(Math.max(skipAfter, 0), 60) : 5,
      starts_at: localInputToIso(f.starts_at),
      ends_at: localInputToIso(f.ends_at),
    };

    const problem = validateAd(payload);
    if (problem) { toast.error(problem); return; }
    if (target && !/^https?:\/\//i.test(target)) { toast.error("The click-through link must start with http:// or https://"); return; }
    if (!f.all_pages && f.page_ids.length === 0) { toast.error("Pick at least one page, or choose “All pages”"); return; }

    setBusy(true);
    try {
      if (ad) await updateVideoAd(ad.id, payload);
      else await createVideoAd(payload);
      toast.success(ad ? "Video ad updated" : "Video ad created");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save the ad"));
    } finally {
      setBusy(false);
    }
  };

  const midRollNum = Number(f.mid_roll_at);
  const minNum = Number(f.min_video);
  const midRollBeyondMin = f.placement === "mid_roll" && midRollNum > 0 && midRollNum >= minNum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{ad ? "Edit video ad" : "New video ad"}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {/* --- creative --- */}
          <div>
            <p className="mb-1 text-sm font-medium">Ad video</p>
            {f.video_url && (
              <video src={f.video_url} poster={f.thumbnail_url ?? undefined} controls preload="metadata"
                className="mb-2 max-h-52 w-full rounded-md border border-border bg-black" />
            )}
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" disabled={uploading}>
                <label className="cursor-pointer">
                  <Upload className="mr-1.5 h-4 w-4" />
                  {uploading ? "Uploading…" : f.video_url ? "Replace video" : "Upload video"}
                  <input type="file" accept="video/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleUpload(file); e.target.value = ""; }} />
                </label>
              </Button>
              <span className="text-xs text-muted-foreground">
                {f.duration_seconds != null ? `Length ${formatClock(f.duration_seconds)} · ` : ""}max {MAX_UPLOAD_MB}MB
              </span>
            </div>
            {uploading && <Progress value={progress} className="mt-2 h-2" />}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Title</p>
            <Input placeholder="e.g. Acme Cola – Summer promo" value={f.title} maxLength={150} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Advertiser (optional)</p>
              <Select value={f.advertiser_id} onValueChange={(v) => set("advertiser_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ADVERTISER}>None</SelectItem>
                  {advertisers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Status</p>
              <Select value={f.status} onValueChange={(v) => set("status", v as AdStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Click-through link (optional)</p>
            <Input placeholder="https://advertiser-website…" value={f.target_url} onChange={(e) => set("target_url", e.target.value)} />
          </div>

          {/* --- where in the video --- */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Where in the video</p>
            <div className="grid grid-cols-3 gap-2">
              {PLACEMENTS.map((p) => (
                <button key={p.id} type="button" onClick={() => set("placement", p.id)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                    f.placement === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{PLACEMENTS.find((p) => p.id === f.placement)?.hint}</p>
            {f.placement === "mid_roll" && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Play at (seconds into the video)</p>
                <Input type="number" min={1} value={f.mid_roll_at} onChange={(e) => set("mid_roll_at", e.target.value)} />
                {midRollBeyondMin && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Videos between {minNum}s and {midRollNum}s long qualify by length but are too short to reach this point, so they won't show this ad.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* --- which videos --- */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Which videos</p>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Only videos longer than (seconds)</p>
              <Input type="number" min={0} value={f.min_video} onChange={(e) => set("min_video", e.target.value)} />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Pages</p>
              <div className="mb-2 grid grid-cols-2 gap-2">
                {([true, false] as const).map((all) => (
                  <button key={String(all)} type="button" onClick={() => set("all_pages", all)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                      f.all_pages === all ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                    )}>
                    {all ? "All pages" : "Specific pages"}
                  </button>
                ))}
              </div>
              {!f.all_pages && <PagePicker value={f.page_ids} onChange={(ids) => set("page_ids", ids)} />}
            </div>
          </div>

          {/* --- viewer experience --- */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Viewers can skip</p>
              <Switch checked={f.skippable} onCheckedChange={(v) => set("skippable", v)} />
            </div>
            {f.skippable && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Skip button appears after (seconds, 0–60)</p>
                <Input type="number" min={0} max={60} value={f.skip_after} onChange={(e) => set("skip_after", e.target.value)} />
              </div>
            )}
          </div>

          {/* --- when --- */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Campaign dates (optional)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Starts</p>
                <Input type="datetime-local" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Ends</p>
                <Input type="datetime-local" value={f.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Leave blank to run with no start or end date. Times are in your local time zone.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy || uploading}>{busy ? "Saving…" : ad ? "Save changes" : "Create ad"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
