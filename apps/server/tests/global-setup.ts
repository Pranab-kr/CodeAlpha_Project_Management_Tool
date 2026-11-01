import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../src/config/env.js";

export default async function globalSetup(): Promise<void> {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
