import { db } from "../../src/db/client.js";
import { users } from "../../src/db/schema/index.js";
import { signAccessToken } from "../../src/lib/tokens.js";

export interface FixtureUser {
  id: string;
  email: string;
  name: string;
  cookies: string;
}

/** Fast fixture user: no bcrypt work; auth still exercises real JWT cookies. */
export async function createTestUser(
  name: string,
  email: string,
): Promise<FixtureUser> {
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: "not-used-in-tests" })
    .returning();
  const token = await signAccessToken({ id: user.id, email: user.email });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    cookies: `ca_access=${token}`,
  };
}
