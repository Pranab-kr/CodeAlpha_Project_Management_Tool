import type { Notification } from "@teamboard/shared";

/** Plain text only; React escapes it on render. */
export function notificationCopy(notification: Notification): string {
  const actor = notification.actor.name;
  const task = notification.task?.title ?? "a task";
  const project = notification.project.name;

  if (notification.type === "task_assigned") {
    return `${actor} assigned you ${task} in ${project}.`;
  }

  const excerpt = notification.commentExcerpt
    ? ` — “${notification.commentExcerpt}”`
    : "";
  return `${actor} commented on ${task} in ${project}${excerpt}`;
}
