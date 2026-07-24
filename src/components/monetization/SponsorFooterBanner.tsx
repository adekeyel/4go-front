import { ExternalLink } from "lucide-react";
import { SPONSOR_URL } from "@/lib/sponsor";
import { usePremium } from "@/hooks/usePremium";

/**
 * Compact sponsor link rendered at the bottom of key pages
 * (Home, Rooms, Profile). Opens in a new tab.
 */
export default function SponsorFooterBanner() {
  const { isPremium } = usePremium();
  if (isPremium) return null;
  return (
    <div className="px-4 pb-4 pt-2">
      <a
        href={SPONSOR_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wide text-primary">Sponsor</span>
          <span className="truncate">Support 4GO — visit our sponsor</span>
        </span>
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
      </a>
    </div>
  );
}