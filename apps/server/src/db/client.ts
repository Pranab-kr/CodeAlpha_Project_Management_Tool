import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });

// pg re-emits idle client failures on the pool. Without a listener Node treats
// the event as unhandled and exits, so a database restart or a dropped socket
// would take the whole API down. Log the code only — never the connection string.
pool.on("error", (error: Error & { code?: string }) => {
  logger.error({ code: error.code }, "database pool error");
});

export const db = drizzle({ client: pool, casing: "snake_case" });

export type Db = typeof db;
/** Drizzle transaction handle (the callback argument of `db.transaction`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Any executor: the pool-backed database or an open transaction. */
export type DbExecutor = Db | Tx;
