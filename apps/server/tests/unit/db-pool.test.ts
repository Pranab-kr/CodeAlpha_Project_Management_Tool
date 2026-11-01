import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../src/db/client.js";
import { closeTestPool } from "../helpers/db.js";

afterAll(closeTestPool);

describe("database pool", () => {
  it("handles idle-client errors instead of crashing the process", () => {
    // pg re-emits idle client failures (for example when PostgreSQL restarts) on
    // the pool. Without a listener, EventEmitter throws and the API process dies.
    expect(pool.listenerCount("error")).toBeGreaterThan(0);
    expect(() =>
      pool.emit(
        "error",
        new Error("terminating connection due to administrator"),
      ),
    ).not.toThrow();
  });
});
