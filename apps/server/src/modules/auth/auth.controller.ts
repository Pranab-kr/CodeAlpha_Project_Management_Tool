import { REFRESH_COOKIE } from "@teamboard/shared";
import type { LoginInput, RegisterInput } from "@teamboard/shared";
import type { RequestHandler } from "express";
import {
  clearAuthCookies,
  readCookie,
  setAuthCookies,
} from "../../lib/cookies.js";
import { AppError } from "../../lib/errors.js";
import {
  getUserById,
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./auth.service.js";

export const register: RequestHandler = async (_req, res) => {
  const input = res.locals.body as RegisterInput;
  const { user, accessToken, refreshToken } = await registerUser(input);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({ data: { user } });
};

export const login: RequestHandler = async (_req, res) => {
  const input = res.locals.body as LoginInput;
  const { user, accessToken, refreshToken } = await loginUser(input);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({ data: { user } });
};

export const refresh: RequestHandler = async (req, res) => {
  const rawToken = readCookie(req, REFRESH_COOKIE);
  if (!rawToken) {
    throw AppError.unauthorized("Session is no longer valid", "UNAUTHORIZED");
  }
  const { user, accessToken, refreshToken } =
    await rotateRefreshToken(rawToken);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({ data: { user } });
};

export const logout: RequestHandler = async (req, res) => {
  const rawToken = readCookie(req, REFRESH_COOKIE);
  if (rawToken) {
    await revokeRefreshToken(rawToken);
  }
  clearAuthCookies(res);
  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw AppError.unauthorized();
  }
  const user = await getUserById(userId);
  if (!user) {
    throw AppError.unauthorized();
  }
  res.status(200).json({ data: { user } });
};
