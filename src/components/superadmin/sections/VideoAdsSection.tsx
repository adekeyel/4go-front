import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Eye, MousePointerClick, Pause, Pencil, Play, Plus, Trash2, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, StatTile } from "./primitives";
import VideoAdDialog from "@/components/superadmin/video-ads/VideoAdDialog";
import {
  apiErrorMessage, deleteVideoAd, listAdvertisers, listVideoAds, updateVideoAd, type AdvertiserOption,
} from "@/api/videoAds";
import { describeRule, effectiveStatus, formatClock, percent, type EffectiveStatus, type VideoAd } from "@/lib/videoAds";

const STATUS_BADGE: Record<EffectiveStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  live: { label: "Live", variant: "default" },
  scheduled: { label: "Scheduled", variant: "outline" },
  expired: { label: "Expired", variant: "secondary" },
  paused: { label: "Paused", variant: "secondary" },
  ended: { label: "Ended", variant: "secondary" },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function scheduleText(ad: VideoAd): string {
  if (ad.starts_at && ad.ends_at) return `${fmtDate(ad.starts_at)} → ${fmtDate(ad.ends_at)}`;
  if (ad.starts_at) return `From ${fmtDate(ad.starts_at)}`;
  if (ad.ends_at) return `Until ${fmtDate(ad.ends_at)}`;
  return "No end date";
}

export default function VideoAdsSection({ id: _id }: { id: string }) {
  const [ads, setAds] = useState<VideoAd[]>([]);
  const [advertisers, setAdvertisers] = useState<AdvertiserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VideoAd | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, adv] = await Promise.all([listVideoAds(), listAdvertisers().catch(() => [] as AdvertiserOption[])]);
      setAds(a);
      setAdvertisers(adv);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load video ads"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const advertiserName = useMemo(() => {
    const m = new Map(advertisers.map((a) => [a.id, a.name]));
    return (aid: string | null) => (aid ? m.get(aid) ?? "Unknown advertiser" : "No advertiser");
  }, [advertisers]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (ad: VideoAd) => { setEditing(ad); setDialogOpen(true); };

  const toggleStatus = async (ad: VideoAd) => {
    const next = ad.status === "active" ? "paused" : "active";
    try {
      const updated = await updateVideoAd(ad.id, { status: next });
      setAds((list) => list.map((x) => (x.id === ad.id ? updated : x)));
      toast.success(next === "active" ? "Ad resumed" : "Ad paused");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const remove = async (ad: VideoAd) => {
    if (!window.confirm(`Delete “${ad.title}”? This can't be undone.`)) return;
    try {
      await deleteVideoAd(ad.id);
      setAds((list) => list.filter((x) => x.id !== ad.id));
      toast.success("Video ad deleted");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const totals = useMemo(() => {
    const impressions = ads.reduce((s, a) => s + a.impressions, 0);
    const completions = ads.reduce((s, a) => s + a.completions, 0);
    const clicks = ads.reduce((s, a) => s + a.clicks, 0);
    return { impressions, completions, clicks, live: ads.filter((a) => effectiveStatus(a) === "live").length };
  }, [ads]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Video Ads"
        subtitle={`${ads.length} ad${ads.length === 1 ? "" : "s"} · play inside user videos longer than their minimum length · Premium members never see them`}
        action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Video Ad</Button>}
      />

      {!loading && ads.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Live Ads" value={totals.live} icon={Video} />
          <StatTile label="Ad Views" value={totals.impressions.toLocaleString()} icon={Eye} />
          <StatTile label="Watched to End" value={totals.completions.toLocaleString()} icon={CheckCircle2} />
          <StatTile label="Clicks" value={totals.clicks.toLocaleString()} icon={MousePointerClick} />
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : ads.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground shadow-card">
          No video ads yet. Create one to start showing ads inside user videos.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {ads.map((ad) => {
            const st = STATUS_BADGE[effectiveStatus(ad)];
            return (
              <Card key={ad.id} className="space-y-3 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="relative h-[72px] w-32 shrink-0 overflow-hidden rounded-md border border-border bg-black">
                    {ad.thumbnail_url
                      ? <img src={ad.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      : <Video className="m-auto mt-6 h-6 w-6 text-muted-foreground" />}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium tabular-nums text-white">
                      {formatClock(ad.duration_seconds)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{ad.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{advertiserName(ad.advertiser_id)}</p>
                    {ad.target_url && (
                      <a href={ad.target_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 shrink-0" /> {ad.target_url}
                      </a>
                    )}
                    <Badge variant={st.variant} className="mt-1">{st.label}</Badge>
                  </div>
                </div>

                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p className="text-foreground">{describeRule(ad)}</p>
                  <p>{scheduleText(ad)} · {ad.skippable ? `Skippable after ${ad.skip_after_seconds}s` : "Not skippable"}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {ad.impressions.toLocaleString()} views</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {ad.completions.toLocaleString()} completed ({percent(ad.completions, ad.impressions)})</span>
                  <span className="flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5" /> {ad.clicks.toLocaleString()} clicks ({percent(ad.clicks, ad.impressions)})</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(ad)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  {ad.status !== "ended" && (
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(ad)}>
                      {ad.status === "active"
                        ? <><Pause className="mr-1 h-3.5 w-3.5" /> Pause</>
                        : <><Play className="mr-1 h-3.5 w-3.5" /> Resume</>}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(ad)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <VideoAdDialog open={dialogOpen} onOpenChange={setDialogOpen} ad={editing} advertisers={advertisers} onSaved={() => void load()} />
    </div>
  );
}
