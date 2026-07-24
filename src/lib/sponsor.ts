// Centralized sponsor monetization link + helpers
export const SPONSOR_URL = "https://omg10.com/4/10916459";

/**
 * Open the sponsor link in a new tab after a short delay (mimics the spec's ~800ms gap
 * so the user clearly understands they're being sent off-site).
 */
export function openSponsor(): void {
  setTimeout(() => {
    try {
      window.open(SPONSOR_URL, "_blank", "noopener,noreferrer");
    } catch {
      // ignore – popup blocked
    }
  }, 800);
}

/* ------------------------------------------------------------------ */
/*  Room 1-in-10 gate                                                 */
/* ------------------------------------------------------------------ */
const ROOM_COUNT_KEY = "roomOpenCount";
const ROOM_LAST_AD_KEY = "lastRoomAdTime";
const ROOM_AD_INTERVAL = 10;
const ROOM_AD_COOLDOWN_MS = 60_000;

/** Increments the room-open counter and returns true when a sponsor gate should be shown. */
export function shouldShowRoomGate(): boolean {
  try {
    const count = Number(localStorage.getItem(ROOM_COUNT_KEY) || "0") + 1;
    localStorage.setItem(ROOM_COUNT_KEY, String(count));
    if (count % ROOM_AD_INTERVAL !== 0) return false;

    const last = Number(localStorage.getItem(ROOM_LAST_AD_KEY) || "0");
    if (Date.now() - last < ROOM_AD_COOLDOWN_MS) return false;

    localStorage.setItem(ROOM_LAST_AD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Contest entry gate                                                */
/* ------------------------------------------------------------------ */
const CONTEST_UNLOCK_KEY = "contestUnlocked";

export function isContestUnlocked(): boolean {
  try {
    return sessionStorage.getItem(CONTEST_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

export function unlockContest(): void {
  try {
    sessionStorage.setItem(CONTEST_UNLOCK_KEY, "true");
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Vignette interstitial ad (menu + DMs navigation)                  */
/* ------------------------------------------------------------------ */
const VIGNETTE_ZONE = "11234875";
const VIGNETTE_SRC = "https://n6wxm.com/vignette.min.js";

/** Injects the vignette ad tag, which self-displays a full-screen interstitial. */
export function triggerVignetteAd(): void {
  try {
    const s = document.createElement("script");
    s.dataset.zone = VIGNETTE_ZONE;
    s.src = VIGNETTE_SRC;
    (
      [document.documentElement, document.body].filter(Boolean).pop() as HTMLElement
    ).appendChild(s);
  } catch {
    /* ignore */
  }
}

const MENU_CLICK_KEY = "menuAdClicks";
const MENU_AD_INTERVAL = 3;
/** True once every 3 menu opens. */
export function shouldShowMenuAd(): boolean {
  try {
    const n = Number(localStorage.getItem(MENU_CLICK_KEY) || "0") + 1;
    localStorage.setItem(MENU_CLICK_KEY, String(n));
    return n % MENU_AD_INTERVAL === 0;
  } catch {
    return false;
  }
}

const DM_NAV_KEY = "dmNavAdClicks";
const DM_NAV_INTERVAL = 6;
/** True once every 6 times the user leaves the DMs page. */
export function shouldShowDmNavAd(): boolean {
  try {
    const n = Number(localStorage.getItem(DM_NAV_KEY) || "0") + 1;
    localStorage.setItem(DM_NAV_KEY, String(n));
    return n % DM_NAV_INTERVAL === 0;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  "Read more" post ad (Feed + Pages)                                */
/* ------------------------------------------------------------------ */
export const READ_MORE_AD_URL = "https://omg10.com/4/11234656";
export const READ_MORE_WORD_LIMIT = 600;
const READ_MORE_AD_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/** True when the read-more ad should be shown for this post (once per post / 6h). */
export function shouldShowReadMoreAd(postId: string): boolean {
  try {
    const key = `readMoreAd:${postId}`;
    const last = Number(localStorage.getItem(key) || "0");
    if (Date.now() - last < READ_MORE_AD_COOLDOWN_MS) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Opens the read-more sponsor ad in a new tab. */
export function openReadMoreAd(): void {
  try {
    window.open(READ_MORE_AD_URL, "_blank", "noopener,noreferrer");
  } catch {
    /* ignore */
  }
}