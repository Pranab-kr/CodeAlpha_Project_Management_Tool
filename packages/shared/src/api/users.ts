import { z } from "zod";

export const searchUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
});
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
