import { z } from "zod";

export const boardColumnSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  position: z.number(),
  createdAt: z.iso.datetime(),
});
export type BoardColumn = z.infer<typeof boardColumnSchema>;
