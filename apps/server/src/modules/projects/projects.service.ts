import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectListItem,
  ProjectSummary,
} from "@teamboard/shared";
import { DEFAULT_COLUMNS } from "@teamboard/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../../db/client.js";
import {
  boardColumns,
  projectMembers,
  projects,
  users,
  type SelectUser,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  toProjectDetail,
  toProjectListItem,
  toProjectSummary,
} from "./projects.mapper.js";
import { requireMembership } from "./projects.permissions.js";

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
