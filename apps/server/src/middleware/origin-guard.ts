import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defense in depth next to SameSite cookies: an unsafe request that carries an
 * Origin header must come from the app's own origin. Requests without an Origin
 * header (curl, server-to-server, tests) are allowed.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== env.APP_ORIGIN) {
    next(
      AppError.forbidden("Request origin is not allowed", "FORBIDDEN_ORIGIN"),
    );
    return;
  }
  next();
};
