import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { pool } from "./db/client.js";
import { AppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { createHealthRouter, type HealthCheck } from "./routes/health.js";

export interface CreateAppOptions {
  healthCheck?: HealthCheck;
}

const defaultHealthCheck: HealthCheck = async () => {
  await pool.query("select 1");
  return true;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(
    "/api/health",
    createHealthRouter(options.healthCheck ?? defaultHealthCheck),
  );

  app.use((_req, _res, next) => {
    next(AppError.notFound());
  });

  app.use(errorHandler);

  return app;
}
