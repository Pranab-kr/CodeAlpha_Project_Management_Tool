import type { Request, RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reduce an origin to its comparable form. URL parsing lowercases the scheme
 * and host and drops default ports, so `HTTP://LOCALHOST:80` and
 * `http://localhost` compare equal. Returns `null` for opaque (`null`) or
 * malformed values.
 */
function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim();
}

/**
 * The origin the browser used to reach this request. Reverse proxies forward
 * the public host/protocol in `X-Forwarded-*`; without them the request's own
 * `Host` header is authoritative.
 */
function requestOrigin(req: Request): string | null {
  const host =
    firstHeaderValue(req.headers["x-forwarded-host"]) ?? req.get("host");
  if (!host) {
    return null;
  }
  const proto =
    firstHeaderValue(req.headers["x-forwarded-proto"]) ?? req.protocol;
  return normalizeOrigin(`${proto}://${host}`);
}

/**
 * Defense in depth next to SameSite cookies: an unsafe request that carries an
 * Origin header must be same-origin with the app. The browser's `Origin` must
 * match either the configured `APP_ORIGIN` or the origin the request was
 * addressed to, so the dev proxy, a `127.0.0.1` visit, the production build on
 * its own port, and a forwarded public host all work. Requests without an
 * Origin header (curl, server-to-server, tests) are allowed.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const rawOrigin = req.headers.origin;
  if (rawOrigin === undefined) {
    next();
    return;
  }
  const origin = normalizeOrigin(rawOrigin);
  const allowed =
    origin !== null &&
    (origin === normalizeOrigin(env.APP_ORIGIN) ||
      origin === requestOrigin(req));
  if (!allowed) {
    next(
      AppError.forbidden("Request origin is not allowed", "FORBIDDEN_ORIGIN"),
    );
    return;
  }
  next();
};
