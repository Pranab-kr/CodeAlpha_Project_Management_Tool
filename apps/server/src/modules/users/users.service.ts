import type {
  SearchUsersQuery,
  UpdateProfileInput,
  UserDTO,
  UserSummary,
} from "@teamboard/shared";
import { and, asc, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { toUserDTO, toUserSummary } from "./users.mapper.js";

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserDTO> {
  const name = input.name;
  if (name === undefined) {
    throw AppError.validation("A display name is required");
  }

  const [updated] = await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) {
    throw AppError.notFound("User not found", "USER_NOT_FOUND");
  }
  return toUserDTO(updated);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function searchUsers(
  query: SearchUsersQuery,
  requesterId: string,
): Promise<UserSummary[]> {
  const term = query.search?.trim();
  if (!term) return [];

  const pattern = `%${escapeLike(term)}%`;
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.id, requesterId),
        or(ilike(users.name, pattern), ilike(users.email, pattern)),
      ),
    )
    .orderBy(asc(users.name), asc(users.id))
    .limit(10);
  return rows.map(toUserSummary);
}
