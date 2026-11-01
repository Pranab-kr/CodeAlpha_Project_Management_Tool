import { Router } from "express";
import pkg from "../../package.json" with { type: "json" };
import { AppError } from "../lib/errors.js";

export type HealthCheck = () => Promise<boolean>;

export function createHealthRouter(healthCheck: HealthCheck): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const dbUp = await healthCheck().catch(() => false);
    if (!dbUp) {
      throw AppError.serviceUnavailable(
        "DB_UNAVAILABLE",
        "Database is unavailable",
      );
    }
    res.json({
      data: {
        status: "ok",
        db: "up",
        uptime: process.uptime(),
        version: pkg.version,
      },
    });
  });

  return router;
}
