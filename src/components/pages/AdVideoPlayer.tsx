import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Play, Volume2, VolumeX } from "lucide-react";
import { fetchServedAds, reportAdEvent } from "@/api/videoAds";
import { formatClock, type AdEventType, type ServedAd } from "@/lib/videoAds";
import { cn } from "@/lib/utils";

// If the ad list hasn't arrived when the viewer first presses play, wait this long before just playing the video.
const FIRST_PLAY_WAIT_MS = 2500;
// If an ad hasn't started playing after this long, give up on it and carry on with the video.
const AD_START_TIMEOUT_MS = 8000;

interface Props {
  /** The id of the thing being watched: a page post, or (with source="message") a chat message. */
  postId: string;
  src: string;
  className?: string;
  /** Page-post videos (default) or a video shared in a chat room. */
  source?: "post" | "message";
  /** Start playing as soon as it's shown (used when a viewer opens a room video). */
  autoPlay?: boolean;
}

/** After an ad: "play" resumes the video, "stay" leaves it where it is (used for the post-roll at the very end). */
type AfterAd = "play" | "stay";

function leaveFullscreen(video: HTMLVideoElement | null) {
  // An ad can't be drawn over a natively fullscreen <video>, so step out of fullscreen first.
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const w = video as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean; webkitExitFullscreen?: () => void }) | null;
    if (w?.webkitDisplayingFullscreen) w.webkitExitFullscreen?.();
  } catch { /* best effort */ }
}

/**
 * A page-post video that can show ads. Whatever goes wrong with the ads (service down, ad won't load,
 * browser blocks playback), the viewer's video still plays.
 *
 * The ad service is asked once the video's real length is known. Pre-roll plays before the video starts,
 * mid-rolls when playback reaches their time, post-roll when the video ends. Each ad plays at most once
 * per player. If someone skips past several mid-rolls in one jump, only the latest one is shown.
 */
export default function AdVideoPlayer({ postId, src, className, source = "post", autoPlay = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLVideoElement>(null);
  const adRef = useRef<HTMLVideoElement>(null);

  const adsRef = useRef<ServedAd[] | null>(null); // null = not loaded yet
  const loadRef = useRef<Promise<ServedAd[]> | null>(null);
  const preHandled = useRef(false);
  const played = useRef<Set<string>>(new Set());
  const reported = useRef<Set<string>>(new Set()); // "adId:type" already sent
  const chains = useRef<Map<string, Promise<void>>>(new Map()); // per-ad queue so events go out in order
  const activeRef = useRef<ServedAd | null>(null);
  const afterRef = useRef<AfterAd>("play");
  const startTimer = useRef<number>();
  const mounted = useRef(true);
  const durationRef = useRef(NaN);
  const visibleRef = useRef(false);

  const [current, setCurrent] = useState<ServedAd | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [adLength, setAdLength] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; window.clearTimeout(startTimer.current); };
  }, []);

  // A different video in the same player starts from scratch.
  useEffect(() => {
    adsRef.current = null; loadRef.current = null; preHandled.current = false;
    played.current = new Set(); reported.current = new Set(); chains.current = new Map();
    activeRef.current = null; durationRef.current = NaN;
    window.clearTimeout(startTimer.current);
    setCurrent(null); setWaiting(false); setNeedsTap(false);
  }, [postId, src]);

  const loadAds = useCallback((duration: number) => {
    if (!loadRef.current) {
      loadRef.current = fetchServedAds(postId, duration, source)
        .catch(() => [] as ServedAd[])
        .then((ads) => { adsRef.current = ads; return ads; });
    }
    return loadRef.current;
  }, [postId, source]);

  // Ask for ads ahead of time, but only for videos that are on screen, so a long feed doesn't fire a request per card.
  const prefetch = useCallback(() => {
    if (visibleRef.current && Number.isFinite(durationRef.current)) void loadAds(durationRef.current);
  }, [loadAds]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { visibleRef.current = true; return; }
    const obs = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) prefetch();
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [prefetch]);

  // Report what the viewer actually saw. Each event is sent at most once per ad, and an ad's events are queued
  // so a completion or click can never reach the server before that ad's view (the server ignores it if it does).
  // Failures are swallowed: counting must never get in the way of playback.
  const track = useCallback((ad: ServedAd, type: AdEventType) => {
    const key = `${ad.id}:${type}`;
    if (reported.current.has(key)) return;
    reported.current.add(key);
    const previous = chains.current.get(ad.id) ?? Promise.resolve();
    chains.current.set(ad.id, previous.then(() => reportAdEvent(ad.id, postId, ad.token, type)).catch(() => {}));
  }, [postId]);

  const finishAd = useCallback(() => {
    window.clearTimeout(startTimer.current);
    if (!activeRef.current) return;
    activeRef.current = null;
    setCurrent(null);
    setNeedsTap(false);
    const c = contentRef.current;
    if (c && afterRef.current === "play") c.play().catch(() => {});
  }, []);

  const playAd = useCallback((ad: ServedAd, after: AfterAd) => {
    const c = contentRef.current;
    if (c && !c.paused) c.pause();
    leaveFullscreen(c);
    played.current.add(ad.id);
    activeRef.current = ad;
    afterRef.current = after;
    setElapsed(0);
    setAdLength(ad.duration_seconds ?? 0);
    setNeedsTap(false);
    setCurrent(ad);
    window.clearTimeout(startTimer.current);
    startTimer.current = window.setTimeout(finishAd, AD_START_TIMEOUT_MS);
  }, [finishAd]);

  // Start the ad's own playback once its <video> exists. Browsers may refuse sound without a recent tap,
  // so retry muted, and as a last resort ask for a tap.
  useEffect(() => {
    if (!current) return;
    const v = adRef.current;
    if (!v) return;
    v.muted = contentRef.current?.muted ?? false;
    v.volume = contentRef.current?.volume ?? 1;
    setMuted(v.muted);
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => { window.clearTimeout(startTimer.current); setNeedsTap(true); });
    });
  }, [current]);

  const startPreRoll = useCallback(async () => {
    const c = contentRef.current;
    if (!c || preHandled.current || activeRef.current) return;
    if (!Number.isFinite(c.duration)) return; // length not known yet; onLoadedMetadata will call this again
    preHandled.current = true;

    let ads = adsRef.current;
    if (ads === null) {
      // Ads still loading: hold the video briefly rather than letting it start and then interrupting it.
      c.pause();
      setWaiting(true);
      ads = await Promise.race([
        loadAds(c.duration),
        new Promise<ServedAd[]>((resolve) => window.setTimeout(() => resolve([]), FIRST_PLAY_WAIT_MS)),
      ]);
      if (!mounted.current) return;
      setWaiting(false);
    }
    const pre = ads.find((a) => a.placement === "pre_roll");
    if (pre) playAd(pre, "play");
    else if (c.paused) c.play().catch(() => {});
  }, [loadAds, playAd]);

  const onLoadedMetadata = () => {
    const c = contentRef.current;
    if (!c || !Number.isFinite(c.duration)) return;
    durationRef.current = c.duration;
    prefetch();
    if (!c.paused) void startPreRoll(); // playback began before the length was known
  };

  const onTimeUpdate = () => {
    const c = contentRef.current;
    const ads = adsRef.current;
    if (!c || !ads || activeRef.current) return;
    const due = ads.filter(
      (a) => a.placement === "mid_roll" && a.mid_roll_at_seconds != null && a.mid_roll_at_seconds <= c.currentTime && !played.current.has(a.id)
    );
    if (due.length === 0) return;
    due.slice(0, -1).forEach((a) => played.current.add(a.id)); // jumped past several: show just the latest
    playAd(due[due.length - 1], "play");
  };

  const onEnded = () => {
    if (activeRef.current) return;
    const post = adsRef.current?.find((a) => a.placement === "post_roll" && !played.current.has(a.id));
    if (post) playAd(post, "stay");
  };

  // Played all the way to the end (a skip or an error is not a completion).
  const onAdEnded = () => {
    const ad = activeRef.current;
    if (ad) track(ad, "completion");
    finishAd();
  };

  const toggleMute = () => {
    const v = adRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const resumeAd = () => {
    const v = adRef.current;
    if (!v) return;
    v.play().then(() => setNeedsTap(false)).catch(() => finishAd());
  };

  const openLink = () => {
    if (!current?.target_url) return;
    window.clearTimeout(startTimer.current);
    track(current, "click");
    adRef.current?.pause();
    setNeedsTap(true); // the viewer taps "Resume ad" when they come back
    window.open(current.target_url, "_blank", "noopener,noreferrer");
  };

  const canSkip = !!current && current.skippable && elapsed >= current.skip_after_seconds;
  const skipIn = current ? Math.max(0, Math.ceil(current.skip_after_seconds - elapsed)) : 0;
  const remaining = adLength > 0 ? Math.max(0, adLength - elapsed) : null;

  return (
    <div ref={wrapRef} className="relative">
      <video
        ref={contentRef}
        src={src}
        controls
        controlsList="nodownload"
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        className={cn("block", className)}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => void startPreRoll()}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />

      {waiting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60" data-testid="ad-waiting">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {current && (
        <div className="absolute inset-0 z-20 bg-black" data-testid="ad-overlay">
          <video
            ref={adRef}
            key={current.id}
            src={current.video_url}
            poster={current.thumbnail_url ?? undefined}
            playsInline
            preload="auto"
            className="h-full w-full object-contain"
            onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setAdLength(d); }}
            onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
            onPlaying={() => {
              window.clearTimeout(startTimer.current);
              // A view counts once the ad is genuinely playing, not merely requested.
              if (activeRef.current) track(activeRef.current, "impression");
            }}
            onEnded={onAdEnded}
            onError={finishAd}
          />

          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
            <span className="rounded bg-yellow-400 px-1 text-[10px] font-bold text-black">Ad</span>
            {remaining != null && <span className="tabular-nums">{formatClock(remaining)}</span>}
          </div>

          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute ad" : "Mute ad"}
            className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {current.target_url && (
            <button type="button" onClick={openLink}
              className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
              <ExternalLink className="h-3.5 w-3.5" /> Learn more
            </button>
          )}

          {current.skippable && (
            canSkip ? (
              <button type="button" onClick={finishAd}
                className="absolute bottom-2 right-2 rounded bg-white px-3 py-1.5 text-xs font-semibold text-black">
                Skip ad ›
              </button>
            ) : (
              <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-3 py-1.5 text-xs font-medium tabular-nums text-white">
                Skip in {skipIn}
              </span>
            )
          )}

          {needsTap && (
            <button type="button" onClick={resumeAd} aria-label="Play ad"
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
              <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black">
                <Play className="h-4 w-4" /> Play ad
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
