import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

export function validateBody<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      next(AppError.validation("Validation failed", { fieldErrors }));
      return;
    }
    res.locals.body = result.data;
    next();
  };
}
