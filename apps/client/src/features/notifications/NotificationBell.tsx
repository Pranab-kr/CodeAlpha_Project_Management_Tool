import type { Notification } from "@teamboard/shared";
import { BellIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { Skeleton } from "../../components/ui/skeleton";
import NotificationItem from "./NotificationItem";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadNotificationCount,
} from "./useNotifications";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unreadQuery = useUnreadNotificationCount();
  const listQuery = useNotificationList(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = unreadQuery.data?.count ?? 0;

  const openNotification = (notification: Notification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    navigate(
      notification.task
        ? `/projects/${notification.project.id}?task=${notification.task.id}`
        : `/projects/${notification.project.id}`,
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
          />
        }
      >
        <BellIcon aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-label={`${unread} unread notifications`}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-0 sm:w-96"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto p-1">
          {listQuery.isPending ? (
            <div
              role="status"
              aria-label="Loading notifications"
              className="space-y-2 p-2"
            >
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : null}

          {listQuery.isError ? (
            <div className="space-y-2 p-3 text-sm">
              <p className="text-muted-foreground">
                Could not load notifications.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {listQuery.isSuccess && listQuery.data.items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : null}

          {listQuery.isSuccess && listQuery.data.items.length > 0 ? (
            <ul aria-label="Notifications list">
              {listQuery.data.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={openNotification}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
