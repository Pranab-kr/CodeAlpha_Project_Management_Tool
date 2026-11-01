import { ACCESS_COOKIE, REFRESH_COOKIE } from "@codealpha/shared";
import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";

/** Refresh cookies are only sent to the auth endpoints that need them. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

const ACCESS_MAX_AGE_MS = env.ACCESS_TOKEN_TTL_MINUTES * 60_000;
const REFRESH_MAX_AGE_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000;

const baseOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.COOKIE_SECURE,
};

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    path: "/",
    maxAge: ACCESS_MAX_AGE_MS,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions, path: "/" });
  res.clearCookie(REFRESH_COOKIE, {
    ...baseOptions,
    path: REFRESH_COOKIE_PATH,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
