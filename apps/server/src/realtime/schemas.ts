import { z } from "zod";

export const joinProjectSchema = z.object({ projectId: z.uuid() });
