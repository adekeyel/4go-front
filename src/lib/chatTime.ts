/** WhatsApp-style time for a chat list: today -> 3:14 PM, yesterday -> Yesterday, this week -> Tuesday, else a date. */
export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = startOfToday.getTime() - d.getTime();
  if (diff <= 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff <= dayMs) return "Yesterday";
  if (diff <= 6 * dayMs) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "2-digit" });
}
