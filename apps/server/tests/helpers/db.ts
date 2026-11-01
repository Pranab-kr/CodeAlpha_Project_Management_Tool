import { sql } from "drizzle-orm";
import { db, pool } from "../../src/db/client.js";

export async function resetDb(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE notifications, comments, tasks, board_columns,
      project_members, projects, sessions, users RESTART IDENTITY CASCADE
  `);
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}
