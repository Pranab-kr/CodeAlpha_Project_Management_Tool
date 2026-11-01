#!/usr/bin/env node
/**
 * Idempotent local bootstrap for CodeAlpha.
 *
 * 1. Create `.env` from `.env.example` with a random `JWT_SECRET` when missing.
 * 2. Start PostgreSQL through Docker Compose and wait for it to accept connections.
 * 3. Make sure the test database exists (Docker volumes created before the init
 *    script ran will not have it).
 * 4. Apply migrations and seed demo data.
 *
 * Safe to run any number of times; every step checks before it acts.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(repoRoot, ".env");
const envExamplePath = resolve(repoRoot, ".env.example");

const DEMO_ACCOUNTS = [
  "maya@codealpha.dev",
  "dev@codealpha.dev",
  "sam@codealpha.dev",
];
const DEMO_PASSWORD = "Password123!";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });
}

function runQuiet(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function ensureEnvFile() {
  if (existsSync(envPath)) {
    console.log("[setup] .env already exists, leaving it untouched.");
    return;
  }
  const secret = randomBytes(48).toString("base64url");
  const contents = readFileSync(envExamplePath, "utf8").replace(
    "replace-me-with-at-least-32-characters",
    secret,
  );
  writeFileSync(envPath, contents);
  console.log("[setup] Created .env with a generated JWT_SECRET.");
}

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function startDatabase() {
  console.log("[setup] Starting PostgreSQL (docker compose up -d db)...");
  run("docker", ["compose", "up", "-d", "db"]);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      runQuiet("docker", [
        "compose",
        "exec",
        "-T",
        "db",
        "pg_isready",
        "-U",
        "codealpha",
        "-d",
        "codealpha",
      ]);
      console.log("[setup] PostgreSQL is ready.");
      return;
    } catch {
      sleep(1);
    }
  }
  throw new Error("PostgreSQL did not become ready within 30 seconds.");
}

function ensureTestDatabase() {
  const exists = runQuiet("docker", [
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "codealpha",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname = 'codealpha_test'",
  ]);
  if (exists === "1") {
    console.log("[setup] Test database codealpha_test already exists.");
    return;
  }
  run("docker", [
    "compose",
    "exec",
    "-T",
    "db",
    "createdb",
    "-U",
    "codealpha",
    "codealpha_test",
  ]);
  console.log("[setup] Created test database codealpha_test.");
}

function migrateAndSeed() {
  console.log("[setup] Applying migrations...");
  run("npm", ["run", "db:migrate"]);
  console.log("[setup] Seeding demo data...");
  run("npm", ["run", "db:seed"]);
}

function main() {
  ensureEnvFile();
  startDatabase();
  ensureTestDatabase();
  migrateAndSeed();

  console.log("\nCodeAlpha is ready.");
  console.log("Demo accounts:");
  for (const email of DEMO_ACCOUNTS) {
    console.log(`  ${email} / ${DEMO_PASSWORD}`);
  }
  console.log(
    "\nNext: npm run dev  (API http://localhost:4000, app http://localhost:5173)",
  );
}

try {
  main();
} catch (error) {
  console.error(
    "[setup] Failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
