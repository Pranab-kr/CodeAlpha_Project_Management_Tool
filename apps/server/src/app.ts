import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";
import { AppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { originGuard } from "./middleware/origin-guard.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { columnsRouter } from "./modules/columns/columns.routes.js";
import { commentsRouter } from "./modules/comments/comments.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { tasksRouter } from "./modules/tasks/tasks.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { createHealthRouter, type HealthCheck } from "./routes/health.js";

export interface CreateAppOptions {
  healthCheck?: HealthCheck;
  /** Defaults to "on outside tests"; integration suites opt out explicitly. */
  enableRateLimit?: boolean;
}

const defaultHealthCheck: HealthCheck = async () => {
  await pool.query("select 1");
  return true;
};

const AUTH_RATE_LIMIT_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
];

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const enableRateLimit = options.enableRateLimit ?? env.NODE_ENV !== "test";

  app.disable("x-powered-by");
  app.set("enableRateLimit", enableRateLimit);
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(originGuard);

  if (enableRateLimit) {
    app.use(
      AUTH_RATE_LIMIT_PATHS,
      createRateLimiter({ windowMs: 60_000, max: 10 }),
    );
    app.use("/api", createRateLimiter({ windowMs: 60_000, max: 300 }));
  }

  app.use(
    "/api/health",
    createHealthRouter(options.healthCheck ?? defaultHealthCheck),
  );
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1", columnsRouter);
  app.use("/api/v1", tasksRouter);
  app.use("/api/v1", commentsRouter);

  app.use((_req, _res, next) => {
    next(AppError.notFound());
  });

  app.use(errorHandler);

  return app;
}
