import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

function rejected(error: z.ZodError): AppError {
  const { fieldErrors } = z.flattenError(error);
  return AppError.validation("Validation failed", { fieldErrors });
}

export function validateBody<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      next(rejected(result.error));
      return;
    }
    res.locals.body = result.data;
    next();
  };
}

export function validateParams<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.params ?? {});
    if (!result.success) {
      next(rejected(result.error));
      return;
    }
    res.locals.params = result.data;
    next();
  };
}

export function validateQuery<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      next(rejected(result.error));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}
