import type { LoginInput, RegisterInput, UserDTO } from "@codealpha/shared";
import { eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db, type Db } from "../../db/client.js";
import { sessions, users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../../lib/tokens.js";
import { toUserDTO } from "../users/users.mapper.js";

export interface AuthResult {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

const DUMMY_PASSWORD = "codealpha-dummy-password";
let dummyHashPromise: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  // Verifying against a real hash keeps unknown-email logins as slow as
  // wrong-password logins, so timing does not reveal which emails exist.
  dummyHashPromise ??= hashPassword(DUMMY_PASSWORD);
  return dummyHashPromise;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === "23505" && pgError.constraint === constraint;
}

async function issueSession(
  executor: Pick<Db, "insert">,
  userId: string,
): Promise<string> {
  const token = generateRefreshToken();
  await executor.insert(sessions).values({
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(
      Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    ),
  });
  return token;
}

const EMAIL_TAKEN_MESSAGE = "An account with this email already exists";

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing) {
    throw AppError.conflict(EMAIL_TAKEN_MESSAGE, "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
        })
        .returning();
      const refreshToken = await issueSession(tx, created.id);
      const accessToken = await signAccessToken({
        id: created.id,
        email: created.email,
      });
      return { user: toUserDTO(created), accessToken, refreshToken };
    });
  } catch (error) {
    // The pre-check above loses to a concurrent registration; the unique index wins.
    if (isUniqueViolation(error, "users_email_unique")) {
      throw AppError.conflict(EMAIL_TAKEN_MESSAGE, "EMAIL_TAKEN");
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    await verifyPassword(input.password, await getDummyHash());
    throw AppError.unauthorized(
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash,
  );
  if (!passwordMatches) {
    throw AppError.unauthorized(
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  const refreshToken = await issueSession(db, user.id);
  const accessToken = await signAccessToken({
    id: user.id,
    email: user.email,
  });
  return { user: toUserDTO(user), accessToken, refreshToken };
}
