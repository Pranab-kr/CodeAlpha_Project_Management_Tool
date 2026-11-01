import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../config/env.js";

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });

export const db = drizzle({ client: pool, casing: "snake_case" });

export type Db = typeof db;
