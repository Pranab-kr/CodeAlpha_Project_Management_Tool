import { searchUsersQuerySchema, updateProfileSchema } from "@teamboard/shared";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import {
  searchUsersController,
  updateProfileController,
} from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.patch(
  "/me",
  validateBody(updateProfileSchema),
  updateProfileController,
);
usersRouter.get(
  "/",
  validateQuery(searchUsersQuerySchema),
  searchUsersController,
);
