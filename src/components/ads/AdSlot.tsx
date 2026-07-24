import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import type { AdPlacementId } from "@/lib/adPlacements";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  image_url: string;
  target_url: string;
}

export type AdPosition = "top" | "middle" | "bottom";

const ROTATE_MS = 5 * 60 * 1000; // rotate every 5 minutes

/**
 * Renders a single manually-managed 320x100 ad banner for a given placement.
 * Premium users never see ads. Impressions/clicks are tracked server-side.
 * When multiple banners target the same placement (and position), they are
 * shown one at a time and rotated every 5 minutes.
 */
export default function AdSlot({
  placement,
  position,
  className,
}: {
  placement: AdPlacementId;
  position?: AdPosition;
  className?: string;
}) {
  const { isPremium, loading: premiumLoading } = usePremium();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const trackedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (premiumLoading || isPremium) return;
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("ad_banners")
        .select("id, image_url, target_url")
        .eq("status", "active")
        .contains("placements", [placement]);
      if (position) query = query.eq("position", position);
      const { data } = await query.limit(20);
      if (cancelled || !data || data.length === 0) { setBanners([]); return; }
      // Shuffle so the starting ad varies per mount.
      const shuffled = [...(data as Banner[])].sort(() => Math.random() - 0.5);
      setBanners(shuffled);
      setIndex(0);
    })();
    return () => { cancelled = true; };
  }, [placement, position, isPremium, premiumLoading]);

  // Rotate through the matching banners every 5 minutes.
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [banners]);

  const banner = banners[index] ?? null;

  useEffect(() => {
    if (banner && !trackedIds.current.has(banner.id)) {
      trackedIds.current.add(banner.id);
      void supabase.rpc("track_ad_event", { p_banner_id: banner.id, p_event: "impression" });
    }
  }, [banner]);

  const handleClick = () => {
    if (!banner) return;
    void supabase.rpc("track_ad_event", { p_banner_id: banner.id, p_event: "click" });
  };

  const container = useMemo(
    () => cn("flex justify-center py-2", className),
    [className],
  );

  if (isPremium || !banner) return null;

  return (
    <div className={container}>
      <a
        href={banner.target_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="relative block overflow-hidden rounded-lg border border-border shadow-sm"
        style={{ width: 320, height: 100 }}
        aria-label="Advertisement"
      >
        <span className="absolute left-1 top-1 z-10 rounded bg-background/70 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ad
        </span>
        <img
          src={banner.image_url}
          alt="Advertisement"
          width={320}
          height={100}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </a>
    </div>
  );
}
