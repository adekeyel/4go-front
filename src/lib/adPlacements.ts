// Shared ad placement definitions used by both the admin manager and the
// on-page AdSlot renderer. Ads render at a fixed 320 x 100 px.
export const AD_PLACEMENTS = [
  { id: "home", label: "Home" },
  { id: "room", label: "Chat Rooms" },
  { id: "dm", label: "Direct Messages" },
  { id: "menu", label: "Menu" },
  { id: "profile", label: "Profile" },
  { id: "feed", label: "Feed" },
] as const;

export type AdPlacementId = (typeof AD_PLACEMENTS)[number]["id"];

export const placementLabel = (id: string): string =>
  AD_PLACEMENTS.find((p) => p.id === id)?.label ?? id;
