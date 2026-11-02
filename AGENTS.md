# AGENTS.md — TeamBoard Operating Manual

This file is canonical for every agent working on TeamBoard. Read it before touching code.

## 1. Read order for every session

1. `AGENTS.md` (this file).
2. `docs/superpowers/specs/2026-11-01-teamboard-design.md` — the product/technical source of truth.
3. The current phase plan in `docs/superpowers/plans/2026-11-01-phase-0N-*.md`.
4. The last two entries of `docs/progress.md`.

Then verify the dependency phase is marked **Done** and the app still runs. Do not start Phase N+1.

## 2. What TeamBoard is

TeamBoard is an internship-level, small-team project management app (Trello/Asana in spirit): authentication, group projects, one Kanban board per project, task assignment, comments, in-app notifications, and realtime updates over WebSockets.

It is a **modular monolith**:

- `apps/server` — Express 5 REST API + Socket.IO on one HTTP server.
- `apps/client` — Vite + React 19 SPA.
- `packages/shared` — Zod schemas, DTOs, constants, and the realtime event map. No database or server code.
- PostgreSQL 18 via Docker; Drizzle ORM; no Redis, queues, microservices, or background workers.
- Single server instance; Socket.IO uses its in-memory adapter.

### Pinned stack (do not upgrade)

Node 24 LTS · TypeScript 6.0.2 · Express 5.3.0 · Drizzle ORM 0.45.4 / drizzle-kit 0.31.11 · pg 8.23.1 · PostgreSQL 18 · React 19.3.1 · Vite 8.3.5 · Tailwind 4.3.3 · shadcn/ui 4.23.0 with **Base UI** (`@base-ui/react` 1.9.0, never Radix) · TanStack Query 5.105.0 · react-router-dom 7.18.5 · react-hook-form 7.91.0 · Socket.IO 4.8.4 · Zod 4.6.7 · jose 6.2.14 · bcryptjs 3.0.3 · Vitest 5.0.5 · Playwright 1.64.1.

If bleeding-edge tooling genuinely breaks the build, the documented fallback is Vite 7 + TypeScript 5.9.3. Record the change in `docs/progress.md` before proceeding.

## 3. Commands

```bash
npm install              # install workspaces
npm run setup            # .env (if missing), Postgres, migrations, seed; idempotent
npm run dev              # server :4000 + client :5173 (Vite proxies /api and /socket.io)
npm run dev -w @teamboard/server
npm run dev -w @teamboard/client

npm run db:up            # docker compose up -d db
npm run db:down
npm run db:generate      # drizzle-kit generate
npm run db:migrate
npm run db:seed          # idempotent demo data
npm run db:reset         # destructive: drop schema, migrate, seed

npm run lint
npm run format            # write
npm run format:check
npm run typecheck
npm test                  # all workspaces
npm test -w @teamboard/server -- tests/integration/<file>.test.ts
npm test -w @teamboard/client -- src/<path>.test.tsx
npm run build
npm start                 # bundled server + built SPA (production shape)
npm run test:e2e          # Playwright smoke (build first, test DB, seeded)
```

Quality gates before marking a phase Done:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e          # Phase 7 onward
```

## 4. Repository map

```text
AGENTS.md
README.md
docs/
  superpowers/specs/2026-11-01-teamboard-design.md
  superpowers/plans/2026-11-01-phase-0N-*.md
  progress.md
  screenshots/
apps/server/drizzle/      # drizzle-kit SQL migrations
apps/server/src/
  app.ts                  # createApp() — no listening
  server.ts               # HTTP server + Socket.IO bootstrap
  config/env.ts           # Zod-validated env
  db/client.ts            # Drizzle + pg pool
  db/schema/              # tables, enums, relations
  db/seed.ts              # idempotent demo
  middleware/             # auth, validate, errors, rate limit, origin
  modules/                # auth, users, projects, columns, tasks, comments, notifications
  realtime/               # io, auth, handlers, presence, emitter
  lib/                    # errors, cookies, tokens, password, ordering, cursor
apps/client/src/
  routes/                 # guards + route elements
  pages/                  # login, register, projects, board, settings, 404
  features/               # auth, projects, board, tasks, comments, notifications, realtime
  components/ui/          # generated shadcn/Base UI primitives (owned in repo)
  components/layout/      # app shell, sidebar, header
  lib/                    # api client, query client, query keys, socket, format
packages/shared/src/
  api/                    # DTOs + Zod request schemas + error codes
  realtime.ts             # event names + payload types
  constants.ts
```

Contracts live in `packages/shared`; schema lives in `apps/server/src/db/schema`; events live in `packages/shared/src/realtime.ts`. The client never imports from `apps/server`.

## 5. Hard rules

- Work on exactly **one phase**. Do not start the next phase, even if the current one finishes early.
- Do not upgrade dependencies, change pinned versions, or switch Drizzle to v1 RC.
- Do not add Redis, queues, microservices, background workers, or a second board per project.
- Do not change the data model, API signatures, DTO shapes, or event contracts without updating:
  1. the design document,
  2. `packages/shared`,
  3. all affected tests,
  4. a decision note in `docs/progress.md`.
- The server is authoritative for authorization. Never rely on UI gating for security.
- Never log or return passwords, password hashes, access tokens, refresh tokens, cookies, or database URLs.
- No `dangerouslySetInnerHTML`; comments are plain text.
- Keep the repo in a runnable state at every commit. No “big bang” integration.
- Ask via a **Blocked** entry in `docs/progress.md` if a decision is outside the design. Do not guess silently.
- Do not commit `.env`, build output, screenshots of secrets, or debug leftovers.
- One task = one red/green cycle and one commit. Do not batch commits across tasks.

## 6. Code conventions

- TypeScript `strict`; ESM with `.js` import suffixes in server code.
- No `any` without a written reason in a comment. Prefer `unknown` + narrowing.
- Zod validates every request body, query, and path param at the boundary; use `@teamboard/shared` schemas.
- Explicit DTO mappers. Never `SELECT *` into a response.
- Modules follow `routes → controller → service`; controllers never contain SQL; services never touch `req`/`res`.
- Wrap multi-write operations in `db.transaction`: project creation, member removal, task move/renumber, notification + triggering write.
- Emit realtime events **after** the transaction commits, never inside it.
- Deterministic ordering always: positions/timestamps plus `id` as the tiebreaker.
- Store UTC `timestamptz`; due dates are date-only strings (`YYYY-MM-DD`) and must not be shifted through UTC midnight.
- Errors use `AppError` with `{ status, code, message, details? }`; one error middleware produces the JSON envelope.
- Pagination only where specified (notifications cursor).
- Rate limits: auth endpoints 10/min/IP; global API 300/min/IP; task/comment writes 60/min/user. Tests disable global limits and exercise limiters explicitly.

## 7. UI conventions

- Tailwind 4 tokens + CSS variables; no ad-hoc component library and no Radix.
- shadcn/ui components are generated into `src/components/ui` and owned/edited in-repo. Base UI is the primitive layer.
- Forms use react-hook-form + Zod directly (no shadcn `form` component in this stack).
- Every icon-only button has `aria-label`; focus rings stay visible; dialogs/sheets trap focus via Base UI.
- Use skeletons for page loads, spinners for mutations, inline retry for query errors, toasts for mutation failures.
- Optimistic updates only for drag-and-drop moves and new comments, with rollback + toast.
- Plain-text comments; React escaping only.
- Responsive rules: sidebar collapses to a sheet under 1024px; board columns ~85vw with horizontal snap; task drawer full-width under 640px.
- Priority must be conveyed by text/badge, not color alone. Due dates show an “Overdue” label.
- Never leave a loading spinner with no timeout/error path.

## 8. Testing requirements

- API integration tests are the backbone and run against real PostgreSQL (`teamboard_test`), never the dev DB.
- Unit tests for pure logic: ordering, recipient selection, cursor, token/cookie helpers, role predicates, Zod edge cases.
- Socket integration tests boot an HTTP server on an ephemeral port, connect with real cookies, and assert auth, room isolation, payloads, presence, and teardown.
- Client tests use Testing Library + a typed fetch stub; mock sockets with a small EventEmitter, not real timers where avoidable.
- Integration files run serially (`fileParallelism: false`); truncate tables before each test.
- Playwright covers the two-user smoke flow in Phase 7.
- Every new endpoint needs success, validation, unauthenticated, forbidden/non-member, and not-found coverage where applicable.
- Every new realtime event needs at least one integration test.
- Coverage percentage is not a target; critical-path coverage is.

## 9. Definition of Done (every phase)

A phase is Done only when:

1. The app builds and starts from a clean clone using the documented setup.
2. `format:check`, `lint`, `typecheck`, `test`, and `build` pass.
3. New endpoints/events have the tests listed above.
4. No secrets, debug logs, dead code, or `TODO`/`FIXME` leftovers are committed.
5. Shared contracts, design, and docs reflect the change.
6. The phase's manual smoke steps are recorded with evidence.
7. `docs/progress.md` is updated with status, decisions, test evidence, known issues, and the next step.
8. The plan's acceptance checklist is fully checked.

If a phase cannot finish, mark it **In progress** and leave an exact remaining-work checklist. Never mark it Done with failing gates.

## 10. Progress protocol

`docs/progress.md` is append-only for history. Use this shape:

```markdown
### YYYY-MM-DD — Phase N — <agent/model>

- Goal:
- Done:
- Decisions:
- Tests / evidence:
- Files touched:
- Next step:
- Blockers:
```

Rules:

- Mark a phase Done only with acceptance criteria and test evidence.
- Record every deviation from the design with rationale.
- Leave the exact next action when stopping mid-phase.
- Keep the “Next-session prompt” current so a fresh agent can start without this conversation.
- Never rewrite earlier session entries; correct them with a new note if needed.

## 11. Common pitfalls

- **Cookie/port mismatch:** always use the Vite origin (`:5173`) in dev. The proxy forwards `/api` and `/socket.io`; do not call `:4000` directly from the browser.
- **Secure cookies:** `COOKIE_SECURE=true` only behind HTTPS. E2E runs with `COOKIE_SECURE=false` over localhost.
- **Refresh path:** `ca_refresh` is scoped to `/api/v1/auth`; requests outside that path must not receive it.
- **Socket auth:** the handshake reads `ca_access`; test with the exact cookie header. An expired token must trigger one refresh + reconnect, not a loop.
- **Drizzle docs:** use the stable 0.45 docs, not the `@rc`/v1 snippets. `casing: "snake_case"` is enabled.
- **Ordering:** clients send neighbour IDs, never positions. Renumber when the midpoint gap is below `1e-6`.
- **Query keys:** extend `src/lib/query-keys.ts`; do not inline ad-hoc keys. Invalidate task lists, details, and project counts together.
- **Seed idempotency:** `npm run setup` and `db:seed` must be safe to run twice.
- **Test DB:** `NODE_ENV=test` must use `TEST_DATABASE_URL`; a missing value must fail loudly.
- **Realtime teardown:** after `member:removed`/`project:deleted`, clear caches and redirect; do not leave a ghost board.
- **Due dates:** parse `YYYY-MM-DD` as a local calendar date; never `new Date("YYYY-MM-DD")` and render through a UTC converter.
- **shadcn:** Base UI only. `npx shadcn@4.23.0 init -b base -p nova -y --no-monorepo`; never pass `-b radix`.

## 12. Fresh-agent prompt

Copy this into a new session, replacing `N`:

```text
You are implementing Phase N of TeamBoard, an internship-level project management app.
Read, in order: AGENTS.md, docs/superpowers/specs/2026-11-01-teamboard-design.md,
docs/superpowers/plans/2026-11-01-phase-0N-*.md, and the latest entries in docs/progress.md.
Verify the previous phase is Done and the app/tests run. Implement only Phase N.
Follow the plan's task order, write the required tests, run every quality gate,
and update docs/progress.md using the handoff template. Do not start Phase N+1.
```

## 13. Current phase map

| Phase | Theme                      | Plan                                                       |
| ----- | -------------------------- | ---------------------------------------------------------- |
| 0     | Foundation and data layer  | `docs/superpowers/plans/2026-11-01-phase-00-foundation.md` |
| 1     | Authentication and session | `2026-11-01-phase-01-auth.md`                              |
| 2     | Projects and membership    | `2026-11-01-phase-02-projects-members.md`                  |
| 3     | Board and tasks            | `2026-11-01-phase-03-board-tasks.md`                       |
| 4     | Collaboration and comments | `2026-11-01-phase-04-comments.md`                          |
| 5     | Notifications              | `2026-11-01-phase-05-notifications.md`                     |
| 6     | Realtime and presence      | `2026-11-01-phase-06-realtime-presence.md`                 |
| 7     | Hardening and delivery     | `2026-11-01-phase-07-hardening-delivery.md`                |

Phases are strictly ordered. Start at Phase 0 unless `docs/progress.md` says otherwise.
