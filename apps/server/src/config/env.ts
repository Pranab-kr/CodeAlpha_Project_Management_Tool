import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// npm workspace scripts run with cwd `apps/server`; the single .env lives at the repo root.
const rootEnvPath = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath, quiet: true });
} else {
  // Production injects real environment variables instead of a file.
  config({ quiet: true });
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_ORIGIN: z.url().default("http://localhost:5173"),
    DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    LOG_LEVEL: z.string().default("info"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "test") {
      if (!value.TEST_DATABASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["TEST_DATABASE_URL"],
          message: "TEST_DATABASE_URL is required when NODE_ENV=test",
        });
      }
      return;
    }
    if (!value.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === "production";

export function resolveDatabaseUrl(): string {
  const url =
    env.NODE_ENV === "test" ? env.TEST_DATABASE_URL : env.DATABASE_URL;
  if (!url) {
    throw new Error(
      env.NODE_ENV === "test"
        ? "TEST_DATABASE_URL is required when NODE_ENV=test"
        : "DATABASE_URL is required",
    );
  }
  return url;
}
