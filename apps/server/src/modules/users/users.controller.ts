import type { SearchUsersQuery, UpdateProfileInput } from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
import { searchUsers, updateProfile } from "./users.service.js";

export const updateProfileController: RequestHandler = async (req, res) => {
  const input = res.locals.body as UpdateProfileInput;
  const user = await updateProfile(requireActorId(req), input);
  res.status(200).json({ data: { user } });
};

export const searchUsersController: RequestHandler = async (req, res) => {
  const query = res.locals.query as SearchUsersQuery;
  const results = await searchUsers(query, requireActorId(req));
  res.status(200).json({ data: { users: results } });
};
