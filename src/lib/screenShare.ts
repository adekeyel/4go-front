/**
 * Can this browser share its screen?
 *
 * Desktop Chrome, Edge, Firefox and Safari can. Browsers on phones and tablets cannot: Chrome and Firefox on Android
 * (and every iPhone / iPad browser) either leave `getDisplayMedia` out or define it and then ALWAYS refuse, so a plain
 * "is it there?" check says yes and the person gets a confusing "cancelled" message. Receiving a shared screen works
 * everywhere; only sending is limited.
 */
export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true; // includes Android tablets, which report "not mobile" in client hints
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  // iPadOS Safari pretends to be a Mac; a "Mac" with a touch screen is an iPad.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function canShareScreen(): boolean {
  if (typeof navigator === "undefined") return false;
  const md = navigator.mediaDevices as (MediaDevices & { getDisplayMedia?: unknown }) | undefined;
  return !!md && typeof md.getDisplayMedia === "function" && !isMobileBrowser();
}

export const SCREEN_SHARE_UNAVAILABLE_MESSAGE =
  "Phone and tablet browsers don't allow websites to share the screen, so sharing isn't possible from here. You can still watch when someone else shares theirs. Use a computer to share yours.";
