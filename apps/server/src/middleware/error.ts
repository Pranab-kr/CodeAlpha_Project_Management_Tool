import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

interface BodyParserError {
  type?: string;
  status?: number;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err }, "request failed");
    }
    const body = err.toJSON();
    res.status(err.status).json({
      error: {
        code: body.code,
        message: body.message,
        ...(body.details === undefined ? {} : { details: body.details }),
      },
    });
    return;
  }

  const parserError = err as BodyParserError;
  if (parserError?.type === "entity.parse.failed") {
    res.status(400).json({
      error: { code: "MALFORMED_JSON", message: "Malformed JSON body" },
    });
    return;
  }
  if (parserError?.type === "entity.too.large") {
    res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" },
    });
    return;
  }

  // Never leak internal details or request bodies to the client.
  logger.error({ err }, "unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
