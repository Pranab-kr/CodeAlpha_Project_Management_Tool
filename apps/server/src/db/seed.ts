import { pathToFileURL } from "node:url";
import type { TaskPriority } from "@codealpha/shared";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, pool, type Db } from "./client.js";
import {
  boardColumns,
  type SelectBoardColumn,
  type SelectComment,
  type SelectTask,
  type SelectUser,
  comments,
  notifications,
  projectMembers,
  projects,
  tasks,
  users,
} from "./schema/index.js";

const DEMO_PASSWORD = "Password123!";
const BCRYPT_COST = 12;
const POSITION_STEP = 1024;

interface DemoUser {
  email: string;
  name: string;
}

interface DemoComment {
  taskTitle: string;
  authorEmail: string;
  body: string;
}

interface DemoNotification {
  recipientEmail: string;
  actorEmail: string;
  type: "task_assigned" | "comment_added";
  taskTitle: string;
  commentAuthorEmail?: string;
}

interface DemoTask {
  column: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeEmail?: string;
  dueInDays?: number;
}

interface DemoProject {
  name: string;
  description: string;
  ownerEmail: string;
  members: { email: string; role: "admin" | "member" }[];
  tasks: DemoTask[];
  comments: DemoComment[];
  notifications: DemoNotification[];
}

const DEMO_USERS: DemoUser[] = [
  { email: "maya@codealpha.dev", name: "Maya Chen" },
  { email: "dev@codealpha.dev", name: "Dev Patel" },
  { email: "sam@codealpha.dev", name: "Sam Rivera" },
];

const COLUMN_NAMES = ["Backlog", "In Progress", "Done"] as const;

const DEMO_PROJECTS: DemoProject[] = [
  {
    name: "Website Redesign",
    description:
      "Refresh the marketing site end to end: new information architecture, a shared design system, and a faster landing page.",
    ownerEmail: "maya@codealpha.dev",
    members: [
      { email: "sam@codealpha.dev", role: "admin" },
      { email: "dev@codealpha.dev", role: "member" },
    ],
    tasks: [
      {
        column: "Backlog",
        title: "Audit the current navigation",
        description:
          "Map every existing page and flag the ones that no longer earn their place.",
        priority: "high",
        assigneeEmail: "dev@codealpha.dev",
        dueInDays: 7,
      },
      {
        column: "Backlog",
        title: "Write homepage copy",
        description:
          "Lead with the outcome, not the feature list. Two drafts for review.",
        priority: "medium",
        dueInDays: 10,
      },
      {
        column: "Backlog",
        title: "Collect brand references",
        description: "Five sites we admire, with notes on what works.",
        priority: "low",
      },
      {
        column: "In Progress",
        title: "Build the new design tokens",
        description:
          "Colors, spacing, and type scale as CSS variables so the app and site share one source of truth.",
        priority: "high",
        assigneeEmail: "dev@codealpha.dev",
        dueInDays: 3,
      },
      {
        column: "In Progress",
        title: "Refactor the hero section",
        description: "Smaller bundle, same layout, sharper headline.",
        priority: "medium",
        assigneeEmail: "sam@codealpha.dev",
      },
      {
        column: "Done",
        title: "Set up the analytics baseline",
        description: "Page views and signup funnel, nothing personal.",
        priority: "medium",
        assigneeEmail: "maya@codealpha.dev",
      },
    ],
    comments: [
      {
        taskTitle: "Build the new design tokens",
        authorEmail: "maya@codealpha.dev",
        body: "Keep indigo as the primary — it tested well with the team.",
      },
      {
        taskTitle: "Build the new design tokens",
        authorEmail: "dev@codealpha.dev",
        body: "Agreed. I'll land the tokens today.",
      },
      {
        taskTitle: "Refactor the hero section",
        authorEmail: "sam@codealpha.dev",
        body: "The new hero is about 40% lighter. Review when you can.",
      },
    ],
    notifications: [
      {
        recipientEmail: "dev@codealpha.dev",
        actorEmail: "maya@codealpha.dev",
        type: "task_assigned",
        taskTitle: "Build the new design tokens",
      },
      {
        recipientEmail: "dev@codealpha.dev",
        actorEmail: "maya@codealpha.dev",
        type: "comment_added",
        taskTitle: "Build the new design tokens",
        commentAuthorEmail: "maya@codealpha.dev",
      },
      {
        recipientEmail: "sam@codealpha.dev",
        actorEmail: "maya@codealpha.dev",
        type: "task_assigned",
        taskTitle: "Refactor the hero section",
      },
    ],
  },
  {
    name: "Mobile App Launch",
    description:
      "Ship the 1.0 mobile release: onboarding, offline support, and store-ready release notes.",
    ownerEmail: "maya@codealpha.dev",
    members: [
      { email: "dev@codealpha.dev", role: "member" },
      { email: "sam@codealpha.dev", role: "member" },
    ],
    tasks: [
      {
        column: "Backlog",
        title: "Draft the onboarding copy",
        description: "Three screens, one idea each.",
        priority: "medium",
        dueInDays: 5,
      },
      {
        column: "Backlog",
        title: "Profile screen empty states",
        description: "Empty, loading, and error states for the profile tab.",
        priority: "low",
        assigneeEmail: "sam@codealpha.dev",
      },
      {
        column: "Backlog",
        title: "Fix the cold-start crash",
        description: "Crash on launch when the stored session is expired.",
        priority: "urgent",
        assigneeEmail: "dev@codealpha.dev",
        dueInDays: -2,
      },
      {
        column: "In Progress",
        title: "Offline cache for the task list",
        description: "Show the last known board when the network drops.",
        priority: "high",
        assigneeEmail: "dev@codealpha.dev",
        dueInDays: 4,
      },
      {
        column: "Done",
        title: "Set up crash reporting",
        description: "Symbols uploaded on every release build.",
        priority: "medium",
        assigneeEmail: "sam@codealpha.dev",
      },
    ],
    comments: [
      {
        taskTitle: "Fix the cold-start crash",
        authorEmail: "sam@codealpha.dev",
        body: "Reproduced on a Pixel 7 — the trace points at session restore.",
      },
    ],
    notifications: [
      {
        recipientEmail: "dev@codealpha.dev",
        actorEmail: "maya@codealpha.dev",
        type: "task_assigned",
        taskTitle: "Fix the cold-start crash",
      },
    ],
  },
];

/** Format a date offset from today as a local calendar date (`YYYY-MM-DD`). */
function localDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function ensureUsers(database: Db): Promise<Map<string, SelectUser>> {
  const byEmail = new Map<string, SelectUser>();
  for (const demo of DEMO_USERS) {
    const [existing] = await database
      .select()
      .from(users)
      .where(eq(users.email, demo.email))
      .limit(1);
    if (existing) {
      byEmail.set(demo.email, existing);
      continue;
    }
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
    const [created] = await database
      .insert(users)
      .values({ email: demo.email, name: demo.name, passwordHash })
      .returning();
    byEmail.set(demo.email, created);
  }
  return byEmail;
}

export async function seed(database: Db = db): Promise<void> {
  const usersByEmail = await ensureUsers(database);

  const userFor = (email: string): SelectUser => {
    const user = usersByEmail.get(email);
    if (!user) throw new Error(`Seed user ${email} is missing`);
    return user;
  };

  for (const definition of DEMO_PROJECTS) {
    const owner = userFor(definition.ownerEmail);
    const [existing] = await database
      .select()
      .from(projects)
      .where(
        and(eq(projects.name, definition.name), eq(projects.ownerId, owner.id)),
      )
      .limit(1);
    if (existing) continue;

    await database.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          name: definition.name,
          description: definition.description,
          ownerId: owner.id,
        })
        .returning();

      await tx.insert(projectMembers).values([
        { projectId: project.id, userId: owner.id, role: "owner" as const },
        ...definition.members.map((member) => ({
          projectId: project.id,
          userId: userFor(member.email).id,
          role: member.role,
        })),
      ]);

      const columns: SelectBoardColumn[] = await tx
        .insert(boardColumns)
        .values(
          COLUMN_NAMES.map((name, index) => ({
            projectId: project.id,
            name,
            position: POSITION_STEP * (index + 1),
          })),
        )
        .returning();
      const columnByName = new Map(
        columns.map((column) => [column.name, column]),
      );

      const nextPosition = new Map<string, number>();
      const tasksByTitle = new Map<string, SelectTask>();
      for (const task of definition.tasks) {
        const column = columnByName.get(task.column);
        if (!column) throw new Error(`Seed column ${task.column} is missing`);
        const position = nextPosition.get(column.id) ?? POSITION_STEP;
        nextPosition.set(column.id, position + POSITION_STEP);
        const [created] = await tx
          .insert(tasks)
          .values({
            projectId: project.id,
            columnId: column.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate:
              task.dueInDays === undefined
                ? null
                : localDateOffset(task.dueInDays),
            assigneeId: task.assigneeEmail
              ? userFor(task.assigneeEmail).id
              : null,
            createdBy: owner.id,
            position,
          })
          .returning();
        tasksByTitle.set(created.title, created);
      }

      const commentsByTask = new Map<string, SelectComment>();
      for (const comment of definition.comments) {
        const task = tasksByTitle.get(comment.taskTitle);
        if (!task) throw new Error(`Seed task ${comment.taskTitle} is missing`);
        const [created] = await tx
          .insert(comments)
          .values({
            taskId: task.id,
            authorId: userFor(comment.authorEmail).id,
            body: comment.body,
          })
          .returning();
        commentsByTask.set(
          `${comment.taskTitle}|${comment.authorEmail}`,
          created,
        );
      }

      for (const notification of definition.notifications) {
        const task = tasksByTitle.get(notification.taskTitle);
        if (!task)
          throw new Error(`Seed task ${notification.taskTitle} is missing`);
        const comment = notification.commentAuthorEmail
          ? commentsByTask.get(
              `${notification.taskTitle}|${notification.commentAuthorEmail}`,
            )
          : undefined;
        await tx.insert(notifications).values({
          userId: userFor(notification.recipientEmail).id,
          actorId: userFor(notification.actorEmail).id,
          type: notification.type,
          projectId: project.id,
          taskId: task.id,
          commentId: comment?.id ?? null,
        });
      }
    });
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seed(db)
    .then(() => {
      console.log("Seed complete: 3 users, 2 projects.");
    })
    .catch((error: unknown) => {
      console.error("Seed failed:", error);
      process.exitCode = 1;
    })
    .finally(() => {
      void pool.end();
    });
}
