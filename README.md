# CodeAlpha

**Project management, minus the chaos.** A small-team project management app in the spirit of
Trello and Asana: projects, a Kanban board, task assignment, comments, in-app notifications,
and live updates over WebSockets.

> **Build status: Phases 0–1 complete (foundation and authentication).** The monorepo,
> PostgreSQL schema, seed data, health check, tooling, and the full cookie-auth stack are in
> place. Projects, boards, comments, notifications, and realtime arrive in later phases. See
> [docs/superpowers/specs](docs/superpowers/specs/2026-11-01-codealpha-design.md).

## Features

| Area            | Status   | Notes                                                    |
| --------------- | -------- | -------------------------------------------------------- |
| Projects        | Planned  | Phase 2 — CRUD, membership, roles                        |
| Board and tasks | Planned  | Phase 3 — columns, drag-and-drop, task drawer            |
| Comments        | Planned  | Phase 4 — flat comments, optimistic posting              |
| Notifications   | Planned  | Phase 5 — assignment and comment notifications           |
| Realtime        | Planned  | Phase 6 — Socket.IO rooms, presence, cache sync          |
| Auth            | **Done** | Cookie sessions, refresh rotation, login/register, shell |
| Foundation      | **Done** | Monorepo, schema, seed, health endpoint, tooling         |

## Stack

Node 24 LTS · TypeScript 6 · Express 5 · Drizzle ORM 0.45 (PostgreSQL 18) · Vite 8 ·
React 19 · Tailwind CSS 4 · shadcn/ui on **Base UI** · TanStack Query · Socket.IO 4 ·
Zod 4 · Vitest 5 · Playwright (Phase 7).

No Redis, queues, microservices, or background workers. One Express process serves the API and
Socket.IO; Vite serves the SPA in development and Express serves the built SPA in production.

## Prerequisites

- Node.js 24 LTS (`nvm use` reads `.nvmrc`; `engines` requires `>=24`)
- Docker with Compose (PostgreSQL 18 runs in a container)

## Quick start

```bash
npm install     # install workspaces
npm run setup   # .env (if missing), Postgres, migrations, seed — safe to re-run
npm run dev     # API on :4000, client on :5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/socket.io` to the API, so
everything is same-origin and cookies behave like production.

### Demo accounts

Seeded by `npm run setup` / `npm run db:seed`. All three use the password `Password123!`:

| Email                | Role in the demo data                                      |
| -------------------- | ---------------------------------------------------------- |
| `maya@codealpha.dev` | Owner of _Website Redesign_ and _Mobile App Launch_        |
| `dev@codealpha.dev`  | Member on both projects, assignee on several tasks         |
| `sam@codealpha.dev`  | Admin on _Website Redesign_, member on _Mobile App Launch_ |

## Scripts

| Script                             | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `npm run setup`                    | Idempotent bootstrap: `.env`, database, migrate, seed |
| `npm run dev`                      | Server and client together (concurrently)             |
| `npm run dev -w @codealpha/server` | API only, with `tsx watch`                            |
| `npm run dev -w @codealpha/client` | Vite client only                                      |
| `npm run db:up` / `db:down`        | Start/stop PostgreSQL via Docker Compose              |
| `npm run db:generate`              | Generate a migration from schema changes              |
| `npm run db:migrate`               | Apply migrations                                      |
| `npm run db:seed`                  | Idempotent demo data                                  |
| `npm run db:reset`                 | Destructive: drop schema, migrate, seed               |
| `npm run lint` / `format`          | ESLint / Prettier (use `format:check` to verify)      |
| `npm run typecheck`                | TypeScript across every workspace                     |
| `npm test`                         | Unit and API integration tests (real PostgreSQL)      |
| `npm run build`                    | Bundle the server, build the SPA                      |
| `npm start`                        | Run the built server                                  |

## Repository layout

```text
apps/server   Express 5 API, Drizzle schema/migrations, seed, tests
apps/client   Vite + React SPA, Tailwind 4, shadcn/ui (Base UI)
packages/shared   Zod schemas, DTOs, constants, realtime contracts
docker/       PostgreSQL init scripts (creates the test database)
docs/         Design document, phase plans, build journal
```

Contracts live in `packages/shared`; the database schema lives in
`apps/server/src/db/schema`; the client never imports server code.

## API

`GET /api/health` returns `{ data: { status: "ok", db: "up", uptime, version } }`, or `503` with
`DB_UNAVAILABLE` when PostgreSQL is unreachable. The product API is mounted under `/api/v1` from
Phase 1 onward.

## Testing

- API integration tests run against the real `codealpha_test` database, apply migrations in a
  global setup, and truncate tables before each test.
- Unit tests cover pure helpers (tokens, ordering, recipient selection).
- Set `NODE_ENV=test` and `TEST_DATABASE_URL` yourself when running a suite directly; the Vitest
  config does both for the server workspace.

## Documentation

- [Design document](docs/superpowers/specs/2026-11-01-codealpha-design.md) — the source of truth
- [Phase plans](docs/superpowers/plans/README.md) — eight executable plans
- [Build journal](docs/progress.md) — status, decisions, evidence, next steps
- [AGENTS.md](AGENTS.md) — operating rules for agents working in this repo

## Limitations

- Single server instance only: realtime uses Socket.IO's in-memory adapter and presence map.
- No email delivery, file uploads, or password reset in v1.
- `codealpha` / `codealpha` credentials are for local development only. Never reuse them.
