import type { ProjectRole } from "@teamboard/shared";
import { and, eq } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import { projectMembers } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

export interface ProjectMembership {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

export function isManager(role: ProjectRole): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export async function getMembership(
  projectId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<ProjectMembership | null> {
  const [row] = await executor
    .select({
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * A missing project and a non-member are deliberately indistinguishable: no
 * response may reveal that a project exists to someone outside it.
 */
export async function requireMembership(
  projectId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<ProjectMembership> {
  const membership = await getMembership(projectId, userId, executor);
  if (!membership) {
    throw AppError.notFound("Project not found", "PROJECT_NOT_FOUND");
  }
  return membership;
}

export async function requireRole(
  projectId: string,
  userId: string,
  roles: ProjectRole[],
  executor: DbExecutor = db,
): Promise<ProjectMembership> {
  const membership = await requireMembership(projectId, userId, executor);
  if (!roles.includes(membership.role)) {
    throw AppError.forbidden(
      "You do not have permission to perform this action",
      "FORBIDDEN",
    );
  }
  return membership;
}
