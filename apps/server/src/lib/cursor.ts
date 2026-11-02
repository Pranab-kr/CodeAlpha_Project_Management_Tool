import { z } from "zod";
import { AppError } from "./errors.js";

const cursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export interface NotificationCursor {
  createdAt: Date;
  id: string;
}

export interface NotificationCursorPayload extends NotificationCursor {
  /** The exact Postgres timestamp text (microseconds preserved). */
  createdAtRaw: string;
}

export function encodeNotificationCursor(cursor: {
  createdAt: Date | string;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      createdAt:
        typeof cursor.createdAt === "string"
          ? cursor.createdAt
          : cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");
}

/** Throws a 422 `INVALID_CURSOR` for any malformed or tampered value. */
export function decodeNotificationCursor(
  value: string,
): NotificationCursorPayload {
  try {
    const parsed = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return {
      createdAt: new Date(parsed.createdAt),
      createdAtRaw: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    throw AppError.unprocessable(
      "INVALID_CURSOR",
      "Invalid notification cursor",
    );
  }
}
