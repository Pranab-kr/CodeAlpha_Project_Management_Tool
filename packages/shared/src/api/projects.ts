import { z } from "zod";
import { boardColumnSchema } from "./columns.js";
import { projectRoleSchema, userSummarySchema } from "./common.js";

export const projectSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  ownerId: z.uuid(),
  memberCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  members: z.array(userSummarySchema).max(4),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectListItemSchema = projectSummarySchema.extend({
  role: projectRoleSchema,
});
export type ProjectListItem = z.infer<typeof projectListItemSchema>;

export const projectMemberSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  name: z.string(),
  initials: z.string(),
  role: projectRoleSchema,
  joinedAt: z.iso.datetime(),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;

export const projectDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  ownerId: z.uuid(),
  role: projectRoleSchema,
  memberCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  members: z.array(projectMemberSchema),
  columns: z.array(boardColumnSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.description !== undefined,
    {
      message: "At least one field is required",
    },
  );
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addMemberSchema = z.object({
  // Trim before the email format check: Zod 4 validates z.email() in place,
  // so padding would otherwise be rejected instead of normalized.
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const projectIdParamsSchema = z.object({ projectId: z.uuid() });
export const projectMemberParamsSchema = z.object({
  projectId: z.uuid(),
  userId: z.uuid(),
});
