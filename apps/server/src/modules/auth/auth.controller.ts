import type { LoginInput, RegisterInput } from "@codealpha/shared";
import type { RequestHandler } from "express";
import { setAuthCookies } from "../../lib/cookies.js";
import { loginUser, registerUser } from "./auth.service.js";

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
