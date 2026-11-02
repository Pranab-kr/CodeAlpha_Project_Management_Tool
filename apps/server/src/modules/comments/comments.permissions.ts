import type { ProjectRole } from "@teamboard/shared";

/** Owner, admin, or the comment author. Plain members cannot delete others'. */
export function canDeleteComment(
  role: ProjectRole,
  authorId: string,
  actorId: string,
): boolean {
  return role === "owner" || role === "admin" || authorId === actorId;
}
