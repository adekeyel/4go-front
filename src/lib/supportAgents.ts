// Verified customer support agents (by username, lowercase)
export const SUPPORT_AGENT_USERNAMES = ["xalamot", "lukman", "ennytanola"] as const;

export function isSupportAgent(username?: string | null): boolean {
  if (!username) return false;
  return (SUPPORT_AGENT_USERNAMES as readonly string[]).includes(
    username.toLowerCase()
  );
}
