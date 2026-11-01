import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/client.js";
import { projects, users } from "../../src/db/schema/index.js";
import { seed } from "../../src/db/seed.js";
import { closeTestPool, resetDb } from "../helpers/db.js";

beforeEach(resetDb);
afterAll(closeTestPool);

describe("seed", () => {
  it("creates demo data idempotently with a working password", async () => {
    await seed(db);
    const firstCount = (await db.select().from(users)).length;
    await seed(db);
    expect((await db.select().from(users)).length).toBe(firstCount);
    expect(firstCount).toBe(3);
    expect((await db.select().from(projects)).length).toBe(2);

    const [maya] = await db
      .select()
      .from(users)
      .where(eq(users.email, "maya@codealpha.dev"));
    expect(maya).toBeDefined();
    await expect(
      bcrypt.compare("Password123!", maya!.passwordHash),
    ).resolves.toBe(true);
  });
});
