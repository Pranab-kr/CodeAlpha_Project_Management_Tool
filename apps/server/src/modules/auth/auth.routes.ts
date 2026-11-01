import { loginSchema, registerSchema } from "@codealpha/shared";
import { Router } from "express";
import { validateBody } from "../../middleware/validate.js";
import { login, register } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), register);
authRouter.post("/login", validateBody(loginSchema), login);
