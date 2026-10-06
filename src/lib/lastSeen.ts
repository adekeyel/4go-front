/** WhatsApp-style presence line for a DM header. */
export function formatLastSeen(isOnline?: boolean | null, lastSeen?: string | null): string {
  if (isOnline) return "online";
  if (!lastSeen) return "offline";
  const d = new Date(lastSeen);
  if (Number.isNaN(d.getTime())) return "offline";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  if (d.getTime() >= startOfToday.getTime()) return `last seen today at ${time}`;
  if (d.getTime() >= startOfToday.getTime() - dayMs) return `last seen yesterday at ${time}`;
  return `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;
}
