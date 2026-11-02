import type {
  AddMemberInput,
  CreateProjectInput,
  ProjectDetail,
  ProjectListItem,
  ProjectMember,
  ProjectSummary,
  UpdateMemberRoleInput,
  UpdateProjectInput,
} from "@teamboard/shared";
import { DEFAULT_COLUMNS } from "@teamboard/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import {
  boardColumns,
  notifications,
  projectMembers,
  projects,
  tasks,
  users,
  type SelectUser,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  toProjectDetail,
  toProjectListItem,
  toProjectMember,
  toProjectSummary,
} from "./projects.mapper.js";
import {
  getMembership,
  requireMembership,
  requireRole,
} from "./projects.permissions.js";

// count(*) is bigint; the cast keeps the pg driver from returning a string.
// Table names are spelled out because Drizzle drops qualifiers for columns
// interpolated inside a correlated subquery (`"id"` would bind to the inner
// table and silently count zero rows).
const memberCountSql = sql<number>`(
  select count(*)::int from "project_members"
  where "project_members"."project_id" = "projects"."id"
)`;
const taskCountSql = sql<number>`(
  select count(*)::int from "tasks"
  where "tasks"."project_id" = "projects"."id"
)`;

const ROLE_PRIORITY_SQL = sql`case ${projectMembers.role}
  when 'owner' then 0
  when 'admin' then 1
  else 2
end`;

async function loadPreviewMembers(
  projectIds: string[],
  executor: DbExecutor = db,
): Promise<Map<string, SelectUser[]>> {
  const previews = new Map<string, SelectUser[]>();
  if (projectIds.length === 0) return previews;

  const rows = await executor
    .select({ projectId: projectMembers.projectId, user: users })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(inArray(projectMembers.projectId, projectIds))
    .orderBy(asc(projectMembers.joinedAt), asc(users.name), asc(users.id));

  for (const row of rows) {
    const members = previews.get(row.projectId) ?? [];
    if (members.length < 4) members.push(row.user);
    previews.set(row.projectId, members);
  }
  return previews;
}

export async function listProjects(userId: string): Promise<ProjectListItem[]> {
  const rows = await db
    .select({
      project: projects,
      role: projectMembers.role,
      memberCount: memberCountSql,
      taskCount: taskCountSql,
    })
    .from(projects)
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, projects.id),
        eq(projectMembers.userId, userId),
      ),
    )
    .orderBy(desc(projects.updatedAt), asc(projects.id));

  const previews = await loadPreviewMembers(rows.map((row) => row.project.id));
  return rows.map((row) =>
    toProjectListItem(
      {
        project: row.project,
        memberCount: row.memberCount,
        taskCount: row.taskCount,
        previewMembers: previews.get(row.project.id) ?? [],
      },
      row.role,
    ),
  );
}

/**
 * Role-independent summary for callers that have already authorized. Phase 6
 * reuses it for `project:updated`, which is broadcast to the whole project room.
 */
export async function getProjectSummary(
  projectId: string,
  executor: DbExecutor = db,
): Promise<ProjectSummary> {
  const [row] = await executor
    .select({
      project: projects,
      memberCount: memberCountSql,
      taskCount: taskCountSql,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) {
    throw AppError.notFound("Project not found", "PROJECT_NOT_FOUND");
  }
  const previews = await loadPreviewMembers([projectId], executor);
  return toProjectSummary({
    project: row.project,
    memberCount: row.memberCount,
    taskCount: row.taskCount,
    previewMembers: previews.get(projectId) ?? [],
  });
}

export async function getProjectDetail(
  projectId: string,
  userId: string,
  executor: DbExecutor = db,
): Promise<ProjectDetail> {
  const membership = await requireMembership(projectId, userId, executor);

  const [row] = await executor
    .select({
      project: projects,
      memberCount: memberCountSql,
      taskCount: taskCountSql,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) {
    throw AppError.notFound("Project not found", "PROJECT_NOT_FOUND");
  }

  const members = await executor
    .select({
      user: users,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(ROLE_PRIORITY_SQL), asc(users.name), asc(users.id));

  const columns = await executor
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.projectId, projectId))
    .orderBy(asc(boardColumns.position), asc(boardColumns.id));

  return toProjectDetail({
    project: row.project,
    role: membership.role,
    memberCount: row.memberCount,
    taskCount: row.taskCount,
    members,
    columns,
  });
}

export async function createProject(
  input: CreateProjectInput,
  ownerId: string,
): Promise<ProjectDetail> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        name: input.name,
        description: input.description ?? "",
        ownerId,
      })
      .returning();

    await tx
      .insert(projectMembers)
      .values({ projectId: project.id, userId: ownerId, role: "owner" });

    await tx.insert(boardColumns).values(
      DEFAULT_COLUMNS.map((name, index) => ({
        projectId: project.id,
        name,
        position: (index + 1) * 1024,
      })),
    );

    return getProjectDetail(project.id, ownerId, tx);
  });
}

export async function updateProject(
  projectId: string,
  actorId: string,
  input: UpdateProjectInput,
): Promise<ProjectDetail> {
  await requireRole(projectId, actorId, ["owner", "admin"]);

  const patch: { name?: string; description?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;

  await db.update(projects).set(patch).where(eq(projects.id, projectId));
  return getProjectDetail(projectId, actorId);
}

export async function deleteProject(
  projectId: string,
  actorId: string,
): Promise<void> {
  await requireRole(projectId, actorId, ["owner"]);
  await db.delete(projects).where(eq(projects.id, projectId));
}

async function loadMemberRows(projectId: string) {
  return db
    .select({
      user: users,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(ROLE_PRIORITY_SQL), asc(users.name), asc(users.id));
}

export async function listMembers(
  projectId: string,
  actorId: string,
): Promise<ProjectMember[]> {
  await requireMembership(projectId, actorId);
  const rows = await loadMemberRows(projectId);
  return rows.map(toProjectMember);
}

function isDuplicateMembership(error: unknown): boolean {
  const pgError = error as { code?: string; constraint?: string };
  return (
    pgError?.code === "23505" && pgError.constraint === "project_members_pkey"
  );
}

const ALREADY_MEMBER_MESSAGE = "This user is already a member";

export async function addMember(
  projectId: string,
  actorId: string,
  input: AddMemberInput,
): Promise<ProjectMember> {
  await requireRole(projectId, actorId, ["owner", "admin"]);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (!user) {
    throw AppError.notFound("User not found", "USER_NOT_FOUND");
  }

  const existing = await getMembership(projectId, user.id);
  if (existing) {
    throw AppError.conflict(ALREADY_MEMBER_MESSAGE, "ALREADY_MEMBER");
  }

  try {
    const [membership] = await db
      .insert(projectMembers)
      .values({ projectId, userId: user.id, role: "member" })
      .returning();
    return toProjectMember({
      user,
      role: membership.role,
      joinedAt: membership.joinedAt,
    });
  } catch (error) {
    // The pre-check loses to a concurrent add; the composite key wins.
    if (isDuplicateMembership(error)) {
      throw AppError.conflict(ALREADY_MEMBER_MESSAGE, "ALREADY_MEMBER");
    }
    throw error;
  }
}

export async function updateMemberRole(
  projectId: string,
  actorId: string,
  targetUserId: string,
  input: UpdateMemberRoleInput,
): Promise<ProjectMember> {
  await requireRole(projectId, actorId, ["owner"]);

  const target = await getMembership(projectId, targetUserId);
  if (!target) {
    throw AppError.notFound("Member not found", "MEMBER_NOT_FOUND");
  }
  if (target.role === "owner") {
    throw AppError.conflict(
      "The project owner's role cannot be changed",
      "CANNOT_CHANGE_OWNER_ROLE",
    );
  }

  const [updated] = await db
    .update(projectMembers)
    .set({ role: input.role })
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, targetUserId),
      ),
    )
    .returning();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!user) {
    throw AppError.notFound("Member not found", "MEMBER_NOT_FOUND");
  }
  return toProjectMember({
    user,
    role: updated.role,
    joinedAt: updated.joinedAt,
  });
}

export async function removeMember(
  projectId: string,
  actorId: string,
  targetUserId: string,
): Promise<void> {
  const actor = await requireMembership(projectId, actorId);
  const target = await getMembership(projectId, targetUserId);
  if (!target) {
    throw AppError.notFound("Member not found", "MEMBER_NOT_FOUND");
  }
  if (target.role === "owner") {
    throw AppError.conflict(
      "The project owner cannot be removed",
      "CANNOT_REMOVE_OWNER",
    );
  }

  const isSelf = targetUserId === actorId;
  if (!isSelf) {
    if (actor.role === "member") {
      throw AppError.forbidden(
        "You do not have permission to remove this member",
        "FORBIDDEN",
      );
    }
    if (actor.role === "admin" && target.role === "admin") {
      throw AppError.forbidden(
        "Admins cannot remove other admins",
        "FORBIDDEN",
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({ assigneeId: null })
      .where(
        and(eq(tasks.projectId, projectId), eq(tasks.assigneeId, targetUserId)),
      );
    await tx
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, targetUserId),
          eq(notifications.projectId, projectId),
        ),
      );
    await tx
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, targetUserId),
        ),
      );
  });
}
