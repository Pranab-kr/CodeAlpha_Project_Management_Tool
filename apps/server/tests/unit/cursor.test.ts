import { describe, expect, it } from "vitest";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "../../src/lib/cursor.js";
import { AppError } from "../../src/lib/errors.js";

describe("notification cursor", () => {
  it("round-trips a date and id", () => {
    const cursor = {
      createdAt: new Date("2026-11-02T10:15:30.123Z"),
      id: "22222222-2222-4222-8222-222222222222",
    };

    const encoded = encodeNotificationCursor(cursor);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(decodeNotificationCursor(encoded)).toMatchObject(cursor);
  });

  it("rejects malformed base64 and JSON", () => {
    for (const value of [
      "not-base64?",
      Buffer.from("not json").toString("base64url"),
    ]) {
      expect(() => decodeNotificationCursor(value)).toThrowError(AppError);
      try {
        decodeNotificationCursor(value);
      } catch (error) {
        expect((error as AppError).code).toBe("INVALID_CURSOR");
        expect((error as AppError).status).toBe(422);
      }
    }
  });

  it("rejects a payload with a bad id or date", () => {
    const badId = Buffer.from(
      JSON.stringify({ createdAt: "2026-11-02T10:00:00.000Z", id: "nope" }),
    ).toString("base64url");
    const badDate = Buffer.from(
      JSON.stringify({
        createdAt: "yesterday",
        id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toString("base64url");

    expect(() => decodeNotificationCursor(badId)).toThrowError(AppError);
    expect(() => decodeNotificationCursor(badDate)).toThrowError(AppError);
  });
});
