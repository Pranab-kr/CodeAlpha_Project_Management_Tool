import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../config/env.js";
import { seed } from "./seed.js";

async function reset(): Promise<void> {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    // Drizzle records applied migrations in the `drizzle` schema, so dropping only
    // `public` would leave the journal intact and make migrate() skip every file.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("CREATE SCHEMA public");
    const db = drizzle({ client: pool, casing: "snake_case" });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seed(db);
    console.log(
      "Database reset complete: schema recreated, migrated, and seeded.",
    );
  } finally {
    await pool.end();
  }
}

reset().catch((error: unknown) => {
  console.error("Database reset failed:", error);
  process.exitCode = 1;
});
