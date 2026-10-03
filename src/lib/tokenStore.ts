// Deliberately in-memory only, not localStorage/sessionStorage: the access
// token is short-lived (15m) and re-derived via a silent refresh (cookie ->
// POST /api/auth/refresh) on every page load, so there's nothing to persist
// here and nothing extra exposed to an XSS payload that reads storage.

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}
