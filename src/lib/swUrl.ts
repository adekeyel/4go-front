import { API_URL } from "./apiClient";

// The service worker can't read import.meta.env, so the API address travels in its URL.
// Always register the worker with this exact URL (main.tsx and useNotifications.ts do).
export const SW_URL = `/sw.js?api=${encodeURIComponent(API_URL)}`;
