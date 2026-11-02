import { ACCESS_COOKIE } from "@teamboard/shared";
import type { Request, RequestHandler } from "express";
import { readCookie } from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** The user id guaranteed by `requireAuth`, for controllers and services. */
export function requireActorId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) throw AppError.unauthorized();
  return userId;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = readCookie(req, ACCESS_COOKIE);
  if (!token) {
    next(AppError.unauthorized());
    return;
  }
  try {
    const payload = await verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    // Expired or tampered tokens are indistinguishable to the client.
    next(AppError.unauthorized());
  }
};
