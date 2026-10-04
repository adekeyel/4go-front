import { apiClient } from "@/lib/apiClient";
import { setAccessToken } from "@/lib/tokenStore";
import type { Tables } from "@/types/database";

type Profile = Tables<"profiles">;

interface AuthResponse {
  accessToken: string;
  // Also present for the mobile client (which has no cookie jar); the web
  // client ignores it and relies on the httpOnly cookie the server sets.
  refreshToken: string;
  userId: string;
}

export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: Profile;
}

export async function signup(input: {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
  /** Referral code captured from the invite link; the server pays the referrer. */
  referralCode?: string;
}) {
  const { data } = await apiClient.post<AuthResponse>("/auth/signup", input);
  setAccessToken(data.accessToken);
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", { email, password });
  setAccessToken(data.accessToken);
  return data;
}

export async function logout() {
  await apiClient.post("/auth/logout").catch(() => {});
  setAccessToken(null);
}

export async function fetchMe(): Promise<Me> {
  const { data } = await apiClient.get<Me>("/auth/me");
  return data;
}

/** `phone` is only needed when the server has REQUIRE_PHONE_FOR_RESET on and the account has a phone number saved. */
export async function forgotPassword(email: string, phone?: string) {
  const { data } = await apiClient.post("/auth/forgot-password", { email, ...(phone ? { phone } : {}) });
  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  const { data } = await apiClient.post("/auth/reset-password", { token, newPassword });
  return data;
}

export async function verifyEmail(token: string) {
  const { data } = await apiClient.post("/auth/verify-email", { token });
  return data;
}

export async function resendVerificationEmail() {
  // No dedicated resend endpoint yet — verification is sent automatically at
  // signup and isn't a blocking gate, so this isn't wired to a UI action.
}
