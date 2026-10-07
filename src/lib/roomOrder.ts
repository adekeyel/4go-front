/** The order chats are listed in: pinned first (in the order they were pinned), then the most recently active. */
export function sortChats<T extends { pinned_at: string | null; created_at: string; last_message: { created_at: string } | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.pinned_at && b.pinned_at) return new Date(a.pinned_at).getTime() - new Date(b.pinned_at).getTime();
    if (a.pinned_at) return -1;
    if (b.pinned_at) return 1;
    const ta = new Date(a.last_message?.created_at ?? a.created_at).getTime();
    const tb = new Date(b.last_message?.created_at ?? b.created_at).getTime();
    return tb - ta;
  });
}
