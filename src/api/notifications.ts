import { apiClient } from "@/lib/apiClient";

export interface GlobalNotification {
  id: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
  is_read?: boolean;
}

export interface EmployeeNotification {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export async function listNotifications(): Promise<GlobalNotification[]> {
  const { data } = await apiClient.get("/notifications");
  return data;
}

export async function markNotificationRead(notificationId?: string) {
  await apiClient.post("/notifications/read", notificationId ? { notification_id: notificationId } : {});
}

export async function listMyEmployeeNotifications(limit = 30): Promise<EmployeeNotification[]> {
  const { data } = await apiClient.get("/employees/me/notifications", { params: { limit } });
  return data;
}

export async function markEmployeeNotificationsRead() {
  await apiClient.post("/employees/me/notifications/read");
}
