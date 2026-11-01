import { pino } from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  enabled: env.NODE_ENV !== "test",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers['set-cookie']",
      "res.headers['set-cookie']",
    ],
    censor: "[redacted]",
  },
});
