export type BoostPlan = "tier_2k" | "tier_4k" | "tier_10k" | "tier_20k";

export interface BoostTier {
  plan: BoostPlan;
  coins: number;
  reach: number;
  durationLabel: string;
  durationHours: number;
  badge?: string;
}

export const BOOST_TIERS: BoostTier[] = [
  { plan: "tier_2k",  coins: 2000,  reach: 1000,  durationHours: 5,   durationLabel: "5 hours" },
  { plan: "tier_4k",  coins: 4000,  reach: 2500,  durationHours: 12,  durationLabel: "12 hours", badge: "Popular" },
  { plan: "tier_10k", coins: 10000, reach: 6000,  durationHours: 24,  durationLabel: "24 hours" },
  { plan: "tier_20k", coins: 20000, reach: 15000, durationHours: 168, durationLabel: "7 days",   badge: "Best value" },
];

export const ELIGIBLE_PAGE_RANKS = ["Professional", "Expert", "Master", "King"] as const;
export const MONETIZATION_RANKS = ["Master", "King"] as const;
export const MONETIZATION_RANK = "Master" as const;

export function canCreatePage(rank?: string | null): boolean {
  return !!rank && (ELIGIBLE_PAGE_RANKS as readonly string[]).includes(rank);
}

export function canMonetize(rank?: string | null): boolean {
  return !!rank && (MONETIZATION_RANKS as readonly string[]).includes(rank);
}