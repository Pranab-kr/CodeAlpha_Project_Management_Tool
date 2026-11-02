import { z } from "zod";
import { PROJECT_ROLES } from "../constants.js";

export const projectRoleSchema = z.enum(PROJECT_ROLES);
export type ProjectRoleDTO = z.infer<typeof projectRoleSchema>;

export const userSummarySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  initials: z.string(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;
