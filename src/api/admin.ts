import { apiClient } from "@/lib/apiClient";

/**
 * Everything the super-admin dashboard needs from the backend. These replace the old Supabase
 * table reads, RPCs and edge functions; each one maps to a route under /api (see the backend's
 * routes/admin.ts, broadcast.ts, employees.ts, ads.ts, contests.ts, verification.ts, payouts.ts).
 * Callers pass the row type they expect, e.g. `listUsers<AdminUser>()`.
 */

const get = async <T>(url: string, params?: object): Promise<T> => (await apiClient.get<T>(url, { params })).data;
const post = async <T = unknown>(url: string, body?: object): Promise<T> => (await apiClient.post<T>(url, body)).data;
const patch = async <T = unknown>(url: string, body?: object): Promise<T> => (await apiClient.patch<T>(url, body)).data;
const put = async <T = unknown>(url: string, body?: object): Promise<T> => (await apiClient.put<T>(url, body)).data;
const del = async (url: string): Promise<void> => {
  await apiClient.delete(url);
};

export type StaffRole = "super_admin" | "moderator" | "support" | "employee";

// ---------------------------------------------------------------------------- who am I

/** Any signed-in user can ask; people who aren't staff get null. */
export async function getMyAdminRole(): Promise<StaffRole | null> {
  const { role } = await get<{ role: StaffRole | null }>("/admin/me");
  return role ?? null;
}

// ---------------------------------------------------------------------------- users

/** Newest first. `limit` is honoured up to 1000 once the backend change is deployed; older backends cap at 200. */
export const listUsers = <T = unknown>(q?: string, limit?: number) =>
  get<T[]>("/admin/users", { ...(q ? { q } : {}), ...(limit ? { limit } : {}) });
export const getUserDetail = <T = unknown>(userId: string) => get<T>(`/admin/users/${userId}/detail`);
export const suspendUser = (userId: string, reason: string) =>
  post(`/admin/users/${userId}/suspend`, { reason: reason.trim() || "No reason given" });
export const unsuspendUser = (userId: string) => post(`/admin/users/${userId}/unsuspend`);
export const setUserMonetized = (userId: string, value: boolean) => post(`/admin/users/${userId}/monetized`, { value });
export const setUserVerified = (userId: string, enabled: boolean) => post(`/admin/users/${userId}/verified`, { enabled });
/** Premium goes through the subscriptions table; `days` only matters when granting. */
export const setUserPremium = (userId: string, enabled: boolean, days = 30) =>
  post(`/admin/users/${userId}/premium`, { enabled, days });
export const deleteUser = (userId: string) => del(`/admin/users/${userId}`);
export const notifyUser = (userId: string, title: string, body: string, url?: string) =>
  post(`/admin/users/${userId}/notify`, { title, body, ...(url ? { url } : {}) });

// ---------------------------------------------------------------------------- reports and moderation

export const listReports = <T = unknown>(status?: string) => get<T[]>("/admin/reports", status ? { status } : undefined);
/** Reports about messages, with the message and both people. `types` filters by message type (e.g. image, video). */
export const listReportedMessages = <T = unknown>(types?: string[]) =>
  get<T[]>("/admin/reports/messages", types && types.length ? { types: types.join(",") } : undefined);
export const listFlaggedAccounts = <T = unknown>() => get<T[]>("/admin/flagged-accounts");
export const setReportStatus = (reportId: string, status: "resolved" | "dismissed" | "actioned") =>
  patch(`/admin/reports/${reportId}`, { status });
/** Staff removal of a message (moderators aren't room members, so the normal delete route refuses them). */
export const adminDeleteMessage = (messageId: string) => del(`/admin/messages/${messageId}`);

// ---------------------------------------------------------------------------- withdrawals

const WITHDRAWAL_STATUSES = ["pending", "approved", "processing", "completed", "rejected", "failed"];

/** The backend lists one status at a time; this fetches them all and returns newest first. */
export async function listAllWithdrawals<T extends { created_at: string }>(limit = 200): Promise<T[]> {
  const parts = await Promise.all(
    WITHDRAWAL_STATUSES.map((status) => get<T[]>("/admin/withdrawals", { status }).catch(() => [] as T[])),
  );
  return parts
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
export const rejectWithdrawal = (id: string) => patch(`/admin/withdrawals/${id}`, { decision: "reject" });
export const approveWithdrawal = (id: string) => patch(`/admin/withdrawals/${id}`, { decision: "approve" });
/** Sends the money through the payment provider (super admin only). */
export const processPayout = (id: string) => post<{ success: boolean; ref?: string; message?: string }>(`/payouts/${id}/process`);
/** Marks a withdrawal as paid by hand. */
export const completePayout = (id: string) => post(`/payouts/${id}/complete`);

// ---------------------------------------------------------------------------- staff

export const listAdmins = <T = unknown>() => get<T[]>("/admin/admins");
/** Adds a staff member, or changes the role of an existing one. */
export const addAdmin = (userId: string, role: StaffRole) => post("/admin/admins", { user_id: userId, role });
export const removeAdmin = (userId: string) => del(`/admin/admins/${userId}`);

// ---------------------------------------------------------------------------- statistics

export const getPlatformStats = <T = unknown>() => get<T>("/admin/stats/platform");
export const getDailyMetrics = <T = unknown>(days = 14) => get<T[]>("/admin/stats/daily", { days });
export const getActiveWindows = <T = unknown>() => get<T>("/admin/stats/active-windows");
/** days = 0 means online right now; otherwise seen in the last N days. */
export const listActiveUsers = <T = unknown>(days: number) => get<T[]>("/admin/stats/active-users", { days });
export const getMessageTypeBreakdown = <T = unknown>() => get<T[]>("/admin/stats/message-types");
export const getChatActivity = <T = unknown>(days = 7, limit = 50) => get<T[]>("/admin/stats/chat-activity", { days, limit });

// ---------------------------------------------------------------------------- audit and security

export const listAuditLogs = <T = unknown>(opts: { action?: string; actor?: string; before?: string; limit?: number } = {}) =>
  get<T[]>("/admin/audit-logs", opts);
export const listDevices = <T = unknown>() => get<T[]>("/admin/devices");
export const getSecurityOverview = <T = unknown>() => get<T>("/admin/security-overview");
/** Force-logs-out one device by removing its push session. Needs the new DELETE /admin/devices/:id backend route. */
export const revokeDevice = (deviceId: string) => del(`/admin/devices/${deviceId}`);

// ---------------------------------------------------------------------------- settings

export interface AppSetting {
  key: string;
  value: unknown;
  label: string | null;
  category: string | null;
}
export const listSettings = (category?: string) => get<AppSetting[]>("/admin/settings", category ? { category } : undefined);
export const saveSettings = (updates: { key: string; value: unknown }[]) => put<{ updated: number }>("/admin/settings", { updates });

// ---------------------------------------------------------------------------- rooms, subscriptions

export const listAdminRooms = <T = unknown>(q?: string) => get<T[]>("/admin/rooms", q ? { q } : undefined);
export const adminDeleteRoom = (roomId: string) => del(`/admin/rooms/${roomId}`);
export const listSubscriptions = <T = unknown>(opts: { status?: string; since?: string; limit?: number } = {}) =>
  get<T[]>("/admin/subscriptions", opts);

// ---------------------------------------------------------------------------- broadcast

export const sendAnnouncement = (title: string, message: string, priority: "low" | "normal" | "high" | "urgent" = "normal") =>
  post<{ ok: boolean; recipients: number }>("/broadcast/announce", { title, message, priority });
export const sendPushBroadcast = (title: string, body: string, url?: string) =>
  post<{ ok: boolean; recipients: number }>("/broadcast/push", { title, body, ...(url ? { url } : {}) });
export const sendEmailBroadcast = (subject: string, message: string) =>
  post<{ ok: boolean; recipients: number }>("/broadcast/email", { subject, message });
export const resendFailedBroadcastEmails = () => post<{ ok: boolean; requeued: number }>("/broadcast/email/resend-failed");
export const getEmailCampaignStats = (days = 7) =>
  get<{ since: string; waiting: number; stats: { status: string; count: number }[] }>("/broadcast/email/stats", { days });
export const listBroadcastDeliveries = <T = unknown>(since?: string) => get<T[]>("/broadcast/deliveries", since ? { since } : undefined);
/** `template` (e.g. "admin_broadcast") narrows the log to one kind of email once the backend change is deployed. */
export const listEmailLog = <T = unknown>(opts: { since?: string; status?: string; q?: string; template?: string; limit?: number } = {}) =>
  get<T[]>("/broadcast/email/log", opts);

// ---------------------------------------------------------------------------- employees

export const listEmployees = <T = unknown>() => get<T[]>("/employees/admin/list");
export const listEmployeeActivityLog = <T = unknown>(opts: { employee?: string; from?: string; to?: string; limit?: number } = {}) =>
  get<T[]>("/employees/admin/activity-log", opts);
/** Always logged for yourself; ignored by the server unless you hold the employee role. */
export const logEmployeeActivity = (action: string, detail?: string, meta?: Record<string, unknown>) =>
  post("/employees/me/activity", { action, ...(detail ? { detail } : {}), ...(meta ? { meta } : {}) });
export const getEmployeePipeline = <T = unknown>(employeeId: string) => get<T>(`/employees/${employeeId}/pipeline`);
export const listEmployeeInvited = <T = unknown>(employeeId: string) => get<T[]>(`/employees/${employeeId}/invited`);
export const listEmployeeDownline = <T = unknown>(employeeId: string) => get<T[]>(`/employees/${employeeId}/downline`);

// ---------------------------------------------------------------------------- verification

export const listVerificationApplications = <T = unknown>(opts: { status?: string; limit?: number; offset?: number } = {}) =>
  get<T[]>("/verification/admin/applications", opts);
export const approveVerification = (applicationId: string, notes?: string | null) =>
  post(`/verification/admin/${applicationId}/approve`, notes ? { notes } : {});
export const rejectVerification = (applicationId: string, notes?: string | null) =>
  post(`/verification/admin/${applicationId}/reject`, notes ? { notes } : {});

// ---------------------------------------------------------------------------- ads

export const listAdminBanners = <T = unknown>() => get<T[]>("/ads/admin/banners");
export const createBanner = <T = unknown>(body: object) => post<T>("/ads/admin/banners", body);
export const updateBanner = <T = unknown>(bannerId: string, body: object) => patch<T>(`/ads/admin/banners/${bannerId}`, body);
export const deleteBanner = (bannerId: string) => del(`/ads/admin/banners/${bannerId}`);

export const listAdvertisers = <T = unknown>() => get<T[]>("/ads/admin/advertisers");
export const createAdvertiser = <T = unknown>(body: object) => post<T>("/ads/admin/advertisers", body);
export const updateAdvertiser = <T = unknown>(advertiserId: string, body: object) =>
  patch<T>(`/ads/admin/advertisers/${advertiserId}`, body);
export const deleteAdvertiser = (advertiserId: string) => del(`/ads/admin/advertisers/${advertiserId}`);

// ---------------------------------------------------------------------------- contests (admin side)

export const createContest = <T = unknown>(body: object) => post<T>("/contests", body);
export const updateContest = <T = unknown>(contestId: string, body: object) => patch<T>(`/contests/${contestId}`, body);
export const deleteContest = (contestId: string) => del(`/contests/${contestId}`);
export const rewardContestParticipant = (contestId: string, userId: string) =>
  post(`/contests/${contestId}/participants/${userId}/reward`);
