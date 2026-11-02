import type { Notification, NotificationList } from "@teamboard/shared";
import { apiFetch } from "../../lib/api";

export function listNotifications(cursor?: string): Promise<NotificationList> {
  const params = new URLSearchParams({ limit: "10" });
  if (cursor) params.set("cursor", cursor);
  return apiFetch<NotificationList>(`/notifications?${params.toString()}`);
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/notifications/unread-count");
}

export function markNotificationRead(
  id: string,
): Promise<{ notification: Notification }> {
  return apiFetch<{ notification: Notification }>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>("/notifications/read-all", {
    method: "POST",
  });
}
