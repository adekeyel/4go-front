import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, setAccessToken } from "./tokenStore";

// Normalise so a trailing slash or a trailing "/api" in VITE_API_URL can't produce /api/api/... URLs.
export const API_URL = String(import.meta.env.VITE_API_URL || "http://localhost:4000")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

// withCredentials so the browser sends/receives the httpOnly refresh-token
// cookie the backend sets on /api/auth/login|signup|refresh.
export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  // No body needed on web — the refresh token travels in the httpOnly cookie.
  const { data } = await axios.post(
    `${API_URL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  );
  setAccessToken(data.accessToken);
  return data.accessToken as string;
}

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;
export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
  onSessionExpired = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? performRefresh();
        const newAccessToken = await refreshPromise;
        refreshPromise = null;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient.request(original);
      } catch (refreshError) {
        refreshPromise = null;
        setAccessToken(null);
        onSessionExpired?.();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

/** Readable message from a failed API call: the backend's `{ error }` text when present. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const m = err.response?.data?.error;
    if (typeof m === "string" && m) return m;
    return fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
