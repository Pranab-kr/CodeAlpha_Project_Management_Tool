import type { NotificationList } from "@teamboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../lib/query-keys";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.api";

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notificationList(),
    queryFn: () => listNotifications(),
    enabled,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: ({ notification }) => {
      queryClient.setQueryData<NotificationList>(
        queryKeys.notificationList(),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === notification.id ? notification : item,
                ),
              }
            : current,
      );
      queryClient.setQueryData<{ count: number }>(
        queryKeys.notificationUnreadCount,
        (current) =>
          current ? { count: Math.max(0, current.count - 1) } : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications,
      });
    },
    onError: () => {
      toast.error("Could not mark the notification read");
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationList>(
        queryKeys.notificationList(),
        (current) =>
          current
            ? {
                ...current,
                unreadCount: 0,
                items: current.items.map((item) =>
                  item.readAt ? item : { ...item, readAt },
                ),
              }
            : current,
      );
      queryClient.setQueryData<{ count: number }>(
        queryKeys.notificationUnreadCount,
        { count: 0 },
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications,
      });
    },
    onError: () => {
      toast.error("Could not mark all as read");
    },
  });
}
