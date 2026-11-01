import { z } from "zod";

export const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  initials: z.string(),
  createdAt: z.iso.datetime(),
});
export type UserDTO = z.infer<typeof userDtoSchema>;

const passwordByteLength = (value: string) =>
  new TextEncoder().encode(value).length;

const atLeast8Bytes = (value: string) => passwordByteLength(value) >= 8;
const atMost72Bytes = (value: string) => passwordByteLength(value) <= 72;

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z
    .string()
    .refine(atLeast8Bytes, { message: "Password must be at least 8 bytes" })
    .refine(atMost72Bytes, { message: "Password must be at most 72 bytes" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).refine(atMost72Bytes, {
    message: "Password must be at most 72 bytes",
  }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => value.name !== undefined, {
    message: "At least one field is required",
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
