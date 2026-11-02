export interface AppErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static notFound(message = "Route not found", code = "NOT_FOUND"): AppError {
    return new AppError(404, code, message);
  }

  static unauthorized(
    message = "Unauthorized",
    code = "UNAUTHORIZED",
  ): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = "Forbidden", code = "FORBIDDEN"): AppError {
    return new AppError(403, code, message);
  }

  static conflict(message: string, code = "CONFLICT"): AppError {
    return new AppError(409, code, message);
  }

  static validation(
    message = "Validation failed",
    details?: unknown,
  ): AppError {
    return new AppError(422, "VALIDATION_ERROR", message, details);
  }

  /** A well-formed request that violates a domain rule (e.g. a foreign column). */
  static unprocessable(
    code: string,
    message: string,
    details?: unknown,
  ): AppError {
    return new AppError(422, code, message, details);
  }

  static serviceUnavailable(code: string, message: string): AppError {
    return new AppError(503, code, message);
  }

  toJSON(): AppErrorBody {
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}
