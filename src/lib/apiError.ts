import axios from "axios";

/** The message the server sent ({ error }), or the fallback. Use in catch blocks. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { error?: unknown; message?: unknown } | undefined;
    if (typeof d?.error === "string" && d.error) return d.error;
    if (typeof d?.message === "string" && d.message) return d.message;
  }
  return fallback;
}
