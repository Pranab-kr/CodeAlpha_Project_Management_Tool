import type { AuthenticatedUser } from "../middleware/auth.js";

declare global {
  namespace Express {
    interface Locals {
      /** Parsed request body, written by `validateBody`. */
      body: unknown;
    }

    interface Request {
      /** Set by `requireAuth` for guarded routes. */
      user?: AuthenticatedUser;
    }
  }
}

export {};
