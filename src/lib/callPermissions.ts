// Single source of truth for which ranks may place/receive voice & video calls.
// Keep this in sync wherever a rank ladder is referenced (ChatRoomPage buttons,
// CallContext runtime checks, etc.) so the UI gate and the enforcement gate
// can never drift apart.

export const VOICE_CALL_RANKS = ["Novice", "Learner", "Professional", "Expert", "Master"];
export const VIDEO_CALL_RANKS = ["Professional", "Expert", "Master"];

export function canMakeVoiceCall(rank?: string | null): boolean {
  return VOICE_CALL_RANKS.includes(rank || "Amateur");
}

export function canMakeVideoCall(rank?: string | null): boolean {
  return VIDEO_CALL_RANKS.includes(rank || "Amateur");
}

export function callPermissionDenialMessage(type: "voice" | "video"): string {
  const requiredRanks = type === "voice" ? VOICE_CALL_RANKS : VIDEO_CALL_RANKS;
  return `You need to reach ${requiredRanks[0]} rank or higher to make ${type} calls.`;
}
