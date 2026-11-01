declare global {
  namespace Express {
    interface Locals {
      /** Parsed request body, written by `validateBody`. */
      body: unknown;
    }
  }
}

export {};
