import type { Notification } from "@teamboard/shared";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { formatRelativeTime, initialsColor } from "../../lib/format";
import { notificationCopy } from "./notification-copy";

export default function NotificationItem({
  notification,
  onSelect,
}: {
  notification: Notification;
  onSelect: (notification: Notification) => void;
}) {
  const unread = notification.readAt === null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Avatar size="sm" aria-label={notification.actor.name}>
          <AvatarFallback className={initialsColor(notification.actor.id)}>
            {notification.actor.initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span
            className={
              unread
                ? "block text-sm font-medium"
                : "block text-sm text-muted-foreground"
            }
          >
            {notificationCopy(notification)}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </span>
        {unread ? (
          <span
            role="img"
            aria-label="Unread notification"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          />
        ) : null}
      </button>
    </li>
  );
}
