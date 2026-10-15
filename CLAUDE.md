# YanChess — Project Context

YanChess is a chess platform MVP: play against the bot (Stockfish WASM), play live online games with matchmaking by rating, challenge friends directly, review game history. Target users are amateur and club-level players (ELO 1200–2100).

Live demo: `https://yan-chess.com` (web) + `https://api.yan-chess.com` (API). See `docs/DEPLOYMENT.md`.

---

## Monorepo layout

pnpm workspaces (`pnpm-workspace.yaml`). Three members:

| Path                  | Role                                              |
| --------------------- | ------------------------------------------------- |
| `apps/web/`           | React 18 + Vite + Tailwind SPA — see its CLAUDE.md |
| `apps/api/`           | NestJS + Prisma + Socket.IO — see its CLAUDE.md    |
| `packages/shared/`    | Pure TypeScript types + Zod schemas — see its CLAUDE.md |

**Dev loop:** `pnpm dev` from repo root starts shared watcher + web + api in parallel via `concurrently` (spec 010). Shared types rebuild automatically whenever `packages/shared/src/` changes.

**First-time setup:** `docker-compose up -d` → `pnpm install` → `pnpm --filter api prisma:migrate:deploy` → `pnpm --filter api db:setup:test` → `pnpm --filter api seed:dev` → `pnpm dev`. Full checklist in `context/product/architecture.md §9 Dev Workflow`.

---

## Specs & workflow

Features are specified via the **AWOS** workflow (`.awos/commands/`):

```
/awos:spec     — functional requirements (what the user sees)
/awos:tech     — technical plan (how we build it)
/awos:tasks    — vertical slice task list with [Agent: name] markers
/awos:implement — orchestrator loops through tasks, delegates each to its agent
/awos:verify   — walks the acceptance criteria, flips Status to Completed
```

**All existing specs live in `context/spec/00N-<short-name>/`.** Each has `functional-spec.md` + `technical-considerations.md` + `tasks.md`. Status (`Draft` → `Completed`) is at the top of each.

Shipped so far (chronological):
1. 001-registration-and-login
2. 002-visual-design-foundation
3. 003-game-board (hotseat)
4. 004-matchmaking-and-online-game
5. 005-play-vs-bot
6. 006-game-history
7. 007-friends
8. 008-backend-dx (SWC build + DI untangle via RealtimeEmitter)
9. 009-dev-db-isolation (`yanchess_test` DB + seed script)
10. 010-frontend-reliability (shared auto-sync + navigation guard)
11. 011-production-deployment (Fly.io stack — in progress)

**Before adding a new feature, run `/awos:spec`.** Don't just start coding.

---

## Available specialist agents

| Agent name            | Use for                                                      |
| --------------------- | ------------------------------------------------------------ |
| `nestjs-backend`      | API services, controllers, gateways, Prisma usage, auth, Zod |
| `react-frontend`      | React components, Zustand stores, Vite config, Tailwind      |
| `postgres-redis-data` | Prisma migrations, schema, Redis key design                  |
| `cloud-infra`         | Dockerfiles, fly.toml, deploy, docker-compose                |
| `chess-engine-specialist` | chess.js, Stockfish, PGN, time controls                  |
| `testing-expert`      | FTR slices only (acceptance tests + RED validation)           |
| `general-purpose`     | Verify slices (Playwright MCP + shell), fallback for everything |

**Spawn agents proactively** when the task matches. Don't do UI work in `nestjs-backend` or vice versa.

---

## Testing conventions

- **Unit:** `pnpm --filter api test:unit` + `pnpm --filter web test -- --run`. Vitest everywhere.
- **E2E (API):** `pnpm --filter api test:e2e` — Supertest + socket.io-client against a NestJS test module. Uses a separate `yanchess_test` Postgres DB + Redis DB index 1 — SAFE to run anytime without touching dev state (spec 009).
- **No Playwright suite in CI.** Playwright MCP is used by `general-purpose` agents during `/awos:verify` for live UI smoke, with screenshots saved to `docs/screenshots/<spec>-<state>.png` only for FTR slices (per-slice Verify screenshots are ephemeral and deleted at task end).
- **Running test:e2e kills port 3000** (it spawns its own API). After test:e2e completes, restart dev-API via `cd apps/api && node dist/main.js &`.
- **The FTR slice** at the end of each `tasks.md` is where acceptance-level tests + RED validation live. `testing-expert` writes them.
- **Current counts (post spec 011):** 95 api unit + 76 api e2e + 278 web tests. Should never regress.

---

## Hard rules — do NOT violate without a spec

1. **No `forwardRef` in `apps/api/src/modules/`.** Spec 008 established the `RealtimeEmitter` pattern — services inject `RealtimeEmitter` + `PresenceService` from `RealtimeModule`, never gateways. `grep -rn forwardRef apps/api/src/modules/` must return 0.
2. **Never commit secrets to git.** `.env` files are in `.gitignore`. Prod secrets live in Fly's secret store (`fly secrets set`). `apps/api/.env.example` shows every env var the API reads with safe placeholders.
3. **UI strings in English in code.** The app's UI language is English. Russian stays in chat replies only (user memory rule).
4. **Don't delete e2e artifacts from the FTR slice.** Per-slice Verify artifacts are ephemeral; FTR artifacts are regression evidence and stay.
5. **Prisma migrations run only in `apps/api` context.** Never duplicate migration state anywhere else.

---

## Product reference

- `context/product/product-definition.md` — vision, personas, feature matrix.
- `context/product/architecture.md` — stack decisions, data model, infrastructure notes. Markers: `_[Confirmed]_` (shipped) vs `_[Assumption]_` (not yet).
- `docs/DEPLOYMENT.md` — step-by-step Fly deploy runbook.

---

## When writing code — pragmatic defaults

- **Add tests only when the task says to.** FTR slices add acceptance tests; implementation tasks don't need to unless the subagent prompt explicitly asks.
- **No comments by default.** Only when a reader can't infer the "why" from the code (hidden constraint, workaround for a specific bug, surprising invariant).
- **Don't refactor adjacent code.** A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. Three similar lines beat a premature abstraction.
- **Match the file's existing style** — don't introduce a new convention mid-file.
- **Reversible actions (edits, tests) are free; irreversible (push, deploy, delete) need user approval.**

---

## When you're confused

- Spec history is in `context/spec/`. Grep for the feature by name.
- Decisions by date are in `context/product/architecture.md § Closed Decisions`.
- Change log entries at the bottom of each `functional-spec.md` capture post-ship amendments.
- **Known deferrals / tech debt / operational TODOs** are centralized in `BACKLOG.md` at the repo root. Check it before adding "nice-to-have" cleanup to a feature spec — it may already be tracked.
