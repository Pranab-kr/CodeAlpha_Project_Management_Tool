import type { RequestHandler } from "express";
import { createRateLimiter } from "./rate-limit.js";

let limiter: RequestHandler | undefined;

/**
 * 60 writes per minute per user, shared by every task and comment write route.
 * One module-scope instance matters: a limiter per route would grant each route
 * its own 60-request bucket.
 */
export function createUserWriteLimiter(): RequestHandler {
  limiter ??= createRateLimiter({
    windowMs: 60_000,
    max: 60,
    keyGenerator: (req) => req.user?.id ?? "anonymous",
    skip: (req) => req.app.get("enableRateLimit") === false,
  });
  return limiter;
}
