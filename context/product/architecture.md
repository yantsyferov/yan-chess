# System Architecture Overview: YanChess

> **Note:** Items marked _[Confirmed]_ are backed by implemented specs (001 Auth, 002 Design, 003 Hotseat, 004 Online Matchmaking, 005 Play vs Bot, 006 Game History, 007 Friends, 008 Backend DX, 009 Dev DB Isolation, 010 Frontend Reliability, 011 Production Deployment) with references to code files or live production services. Items marked _[Assumption]_ are hypotheses derived from `product-definition.md` plus best practices, to be confirmed as the corresponding features ship. Open Decisions in §7 are explicitly unresolved forks for the future.

---

## 1. Application & Technology Stack _[Assumption]_

- **Frontend Framework:** **React 18 + TypeScript + Vite** _[Confirmed]_ (`apps/web/package.json`: `react@^18.3.1`, `typescript@^5.5.4`, `vite@^5.4.0`)
  - _Alternatives:_ Next.js (if SSR is ever needed for profile SEO), SvelteKit.
  - _Why:_ mature ecosystem, rich libraries for the chessboard (`react-chessboard`), fast DX via Vite, type safety.
- **Frontend Design System:** **Tailwind CSS v4 with CSS-variable tokens** _[Confirmed]_ (`apps/web/package.json`: `tailwindcss@^4`, `@tailwindcss/vite@^4`; `apps/web/src/styles/tokens.css` — @theme block + :root[data-theme="dark"|"light"])
  - **Theming:** dark/light theme is controlled by a `data-theme` attribute on `<html>` plus a Zustand store `useThemeStore` (`apps/web/src/features/theme/useThemeStore.ts`). The user's choice is persisted in `localStorage`; on first visit the app falls back to `prefers-color-scheme`. FOUC is eliminated by a synchronous inline script in `apps/web/index.html` that runs before React mounts.
  - **Headless UI primitives:** **Radix UI** (`@radix-ui/react-dropdown-menu@^2`) — used only for the profile dropdown menu; the remaining primitives (Button, Input, Card, Alert, Checkbox, Avatar, Header) are written in-house in `apps/web/src/components/ui/`.
  - **Icons:** **lucide-react** (`^0.400`) — a tree-shakeable, single-weight SVG set used for field, status, menu, and theme icons.
  - **Typography:** **Inter Variable** via `@fontsource-variable/inter@^5` — self-hosted, no requests to Google Fonts; fallback to `system-ui, sans-serif`.
  - _Alternatives:_ CSS Modules + hand-rolled tokens (loses the DX of utility classes); styled-components (runtime cost); PandaCSS/Vanilla-Extract (less mature ecosystem). The choice is fixed by spec `context/spec/002-visual-design-foundation/`.
  - _Why:_ Tailwind v4's CSS-variable-first model enables hot theme switching without re-rendering, produces static output with no runtime, and composes utility classes for glass/blur/shadow effects. Tokens live in a single file visible in DevTools.
- **Backend Framework:** **Node.js + TypeScript + NestJS** _[Confirmed]_ — specs 001-011 (`apps/api/package.json`: `@nestjs/core@^10.4`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/websockets`, `@nestjs/schedule`; 12+ modules under `apps/api/src/modules/`; SWC builder via `nest-cli.json`).
  - _Alternatives:_ Go + Gin (faster for matchmaking), Python + FastAPI.
  - _Why:_ single language/types shared with the frontend, built-in WebSocket gateway support, modular architecture for future features (tournaments, puzzles).
- **Realtime Transport:** **WebSocket via Socket.IO** _[Confirmed]_ — specs 004 + 007 + 011 (`apps/api/src/modules/game/game.gateway.ts` on `/play`, `apps/api/src/modules/friends/friends.gateway.ts` on `/friends`; client singletons `apps/web/src/features/online/socket.ts` + `apps/web/src/features/friends/friends-socket.ts`; prod `wss://api.yan-chess.com/play` verified upgrading directly to websocket transport, no polling fallback).
  - _Alternatives:_ raw WS + ws, WebTransport.
  - _Why:_ reconnects, rooms, long-polling fallback out of the box — critical for games where losing a move means losing on time.
- **Chess Rules Engine (move validation, checkmate/stalemate detection):** **`chess.js`** _[Confirmed]_ — specs 003 + 004 + 005 (used server-side in `apps/api/src/modules/game/chess-rules.service.ts`, client-side for the hotseat page `apps/web/src/pages/Game.tsx` + vs-bot page `apps/web/src/pages/VsBot.tsx`; `chess.js@^1.0`).
  - _Alternatives:_ `chessops`, a custom implementation.
  - _Why:_ de-facto standard, runs on both client and server — one source of truth about position.
- **Chess AI (bot):** **Stockfish 19 as a client-side WASM worker** _[Confirmed]_ (`apps/web/package.json`: `stockfish@^19.0.1`; `apps/web/public/stockfish-19-lite-single.{js,wasm}`; wrapper `apps/web/src/features/vs-bot/stockfish-engine.ts`)
  - _Build variant:_ **lite-single** (single-threaded, classical eval, ~1.8 MB WASM) — does not require `SharedArrayBuffer`, no COOP/COEP headers needed, easy to deploy behind Cloudflare. NNUE variants (99 MB) and multi-threaded builds are rejected — classical eval is sufficient for the 800–2100 ELO range.
  - _Execution:_ browser only. The backend is **not involved** in a game against the bot — training games live in the current tab, are not persisted, and do not affect rating (see spec 005 §2.8).
  - _Strength tuning:_ UCI `Skill Level 0/5` for levels 800/1200 (below the `UCI_Elo` cap), `UCI_LimitStrength + UCI_Elo` for 1500/1800/2100. Movetime 500–2500 ms proportional to level.
  - _Alternatives:_ Leela Chess Zero, a server-side Stockfish container exposing UCI via API, a custom minimax. The server-side path is explicitly rejected in spec 005 — we save resources and network latency.
  - _Why:_ #1 open-source engine by strength, predictable per-level behavior via `UCI_Elo` + `Skill Level`. WASM single-threaded is the minimally deployable option with no compromises for training purposes.
- **Package Manager:** **pnpm** (monorepo via pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`) _[Confirmed]_ — specs 001-011 (`pnpm-workspace.yaml`, root `package.json` `packageManager: pnpm@9.15.0`, every CI/dev loop uses `pnpm --filter ...`).

---

## 2. Data & Persistence _[Assumption]_

- **Primary Database:** **PostgreSQL 16** _[Confirmed]_ — specs 001-011 (local via docker-compose `postgres:16-alpine` with `citext` extension; prod via Neon serverless `eu-west-2` region, pooled connection string in `fly secrets`).
  - _Stores:_ users, profiles, per-mode ratings, game history (PGN + metadata), friends/requests.
  - _Alternatives:_ MySQL, CockroachDB (if horizontal scalability is needed up front).
  - _Why:_ strict transactions for rating and friendship, rich SQL, JSONB for flexible fields (for example, future game analytics).
- **ORM / Query Layer:** **Prisma** _[Confirmed]_ — specs 001-011 (`apps/api/prisma/schema.prisma` with 6 models + 3 enums; 6 migrations applied in both local `yanchess` DB and Neon prod DB; `binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x", "linux-musl-openssl-3.0.x"]` for Alpine Docker runtime; `@prisma/client@^5.22`).
  - _Alternatives:_ Drizzle, TypeORM, Kysely.
  - _Why:_ type-safe queries, migrations, good DX in a TS monorepo.
- **Realtime / Ephemeral State:** **Redis 7** _[Confirmed]_ — specs 004 + 007 + 011 (local via docker-compose `redis:7-alpine` + e2e DB index 1 for isolation per spec 009; prod via Upstash TLS `rediss://` endpoint; namespaces documented in `apps/api/CLAUDE.md`: `session:*`, `mm:*`, `game:*`, `user:activeGame:*`, `rematch:*`, `challenge:*`, `user:activeChallenge:*`, `rl:*`).
  - _Stores:_ matchmaking queue, active game sessions (position, clocks, whose turn), pub/sub between API instances to broadcast updates.
  - _Alternatives:_ KeyDB, Dragonfly, in-memory (unsuitable with >1 instance).
  - _Why:_ atomic operations on queues, pub/sub out of the box — classic for online games.
- **Session / Auth Tokens:** **JWT (short-lived access) + refresh tokens in Redis** _[Confirmed]_ — spec 001 + spec 011 (access tokens HS256 signed via `JWT_ACCESS_SECRET` secret, 15 min TTL; refresh tokens stored in Redis `session:{token}` with per-user index `user:sessions:{userId}`, 30-day TTL for "remember me" / 24h for session; `apps/api/src/modules/auth/`; cookie flags `COOKIE_SECURE=true` + `COOKIE_SAMESITE=None` in prod for cross-subdomain yan-chess.com ↔ api.yan-chess.com).
  - _Alternatives:_ server-side cookie sessions + Redis.
- **File Storage (avatars):** **S3-compatible storage (AWS S3 / Cloudflare R2 / MinIO locally)** _[Assumption]_
  - _Why:_ cheap, CDN-friendly, does not load the DB.

---

## 3. Infrastructure & Deployment _[Assumption]_

- **Cloud Provider / Hosting:** **Fly.io** for MVP _[Confirmed]_ — spec 011 (`fly.api.toml`, `fly.web.toml`; apps `yanchess-api` + `yanchess` in region `fra`).
  - _Alternatives:_ Railway, Render, AWS ECS/Fargate, DigitalOcean App Platform.
  - _Why:_ cheap, global regions (important for low realtime latency), WebSockets out of the box, built-in Postgres/Redis.
- **Containerization:** **Docker** (multi-stage builds), **Docker Compose** for local development _[Confirmed]_ — spec 011 (`apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml`).
- **Orchestration:** Fly Machines for MVP; Kubernetes (EKS/GKE) as we grow _[Assumption]_
- **CI/CD:** **GitHub Actions** _[Assumption]_
  - _Pipeline:_ lint → typecheck → unit tests → e2e on preview environment → deploy to Fly.io.
- **Environments:** `local` → `preview` (per-PR) → `staging` → `production` _[Assumption]_
- **Secrets:** Fly.io secrets for all runtime config (13 secrets on `yanchess-api`; web has none — `VITE_API_URL` is baked at build time) _[Confirmed]_ — spec 011.
- **CDN:** **Cloudflare** in front of the web client and static assets _[Assumption]_
- **Deployment runbook:** step-by-step first-deploy + routine-deploy procedure lives in [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md). _[Confirmed]_ — spec 011.

---

## 4. External Services & APIs _[Assumption]_

- **Authentication:**
  - **Primary:** email + password via an in-house service (argon2 for hashes, JWT + refresh) _[Confirmed]_ — spec 001 + 011 (`apps/api/src/modules/auth/`; argon2id used; prod `yanchess-api` running).
  - **OAuth (optional for MVP):** Google via standard OAuth 2.0 — `passport-google-oauth20` library or hand-rolled _[Assumption]_.
  - _Alternatives:_ managed providers (Clerk, Auth0, Supabase Auth) — faster to stand up but more expensive and offer less control over the player profile.
- **Transactional Email (registration confirmation, password reset):** **Resend** _[Confirmed]_ — spec 011 (`apps/api/src/modules/mail/resend.mailer.ts`; verified domain `yan-chess.com` with DNS SPF/DKIM via GoDaddy; sender `YanChess <noreply@yan-chess.com>`; dev driver `DevOutboxMailer` writes JSON files to `apps/api/dev-outbox/` — env-branched on `MAIL_DRIVER`).
  - _Alternatives:_ Postmark, SendGrid, AWS SES.
- **Payments / Monetization:** **not in MVP** (see product-definition §3.2).

---

## 5. Observability & Monitoring _[Assumption]_

- **Logging:** **structured JSON logs via Pino** on the backend, aggregated in **Better Stack / Logtail** or **Grafana Loki** _[Assumption]_
  - _Alternatives:_ Datadog Logs (expensive), ELK (too complex for MVP).
- **Error Tracking:** **Sentry** on both frontend and backend _[Assumption]_
- **Metrics:** **Prometheus + Grafana** via `prom-client` on the backend _[Assumption]_
  - _Key metrics for product SLOs:_
    - `matchmaking.queue.wait_seconds` (histogram) — tied to the "time to game <15 s" metric.
    - `games.active.gauge`, `games.started.total`, `games.ended.total{reason=...}`.
    - `websocket.connected.gauge`, `websocket.message.latency_ms`.
    - `rating.calculation.duration_ms`.
- **Uptime / Synthetic:** **Better Stack Uptime** or **UptimeRobot** on `/health` and `/ws-health` _[Assumption]_
- **Tracing:** OpenTelemetry exported to **Grafana Tempo** (optional, if we hit realtime latency walls) _[Assumption]_

---

## 6. Realtime Game Flow (end-to-end scenario) _[Assumption]_

> Not a standalone "area" — but a critical cross-cut that ties §1–§5 together. We fix it so that specs can rely on a single model.

1. The client (React) connects to the API over WebSocket (Socket.IO) and authenticates via JWT.
2. Clicking "Find game" → the client sends `queue.join{mode, rating}` → the API places the player in a Redis sorted set per mode.
3. The matchmaking worker (inside the API or a separate process) polls the queue, pairs players by rating proximity, and creates a game in Postgres + state in Redis.
4. Both clients receive `game.start` and the board opens. For every move: the client validates locally via `chess.js` → sends `game.move` → the server validates with the same library → updates Redis and broadcasts `game.state` to both.
5. On completion: Postgres writes the final record (PGN, result, reason), recalculates ratings using classical ELO (K=32 for a player's first 30 games in a mode, K=16 after), and clears Redis.

---

## 7. Open Decisions (to be confirmed)

- **Monorepo vs two repos:** pnpm workspaces vs separate repositories for web/api.
- **OAuth in MVP:** keep email+password only for speed, or ship Google right away?
- **Hosting:** Fly.io (simple) vs AWS (flexible but heavier) — especially important given growth plans.

---

## 8. Backend Module Patterns _[Confirmed]_

**Rule:** Services never inject gateways. Gateways never inject services from other feature modules.

To emit a socket event or check online presence, inject `RealtimeEmitter` or `PresenceService` from `RealtimeModule` (`apps/api/src/modules/realtime/`). Both are facade services with no back-dependency on any feature module.

**Minimal example — a new `MyFeatureService` that emits an event to a user's `friends` room:**

```ts
@Injectable()
export class MyFeatureService {
  constructor(private readonly realtime: RealtimeEmitter) {}

  async notify(userId: string): Promise<void> {
    this.realtime.toUser(userId, 'friends').emit('my.event', { ok: true });
  }
}
```

**Module DAG (post-spec 008):**

```
AppModule
├── FriendsModule → RealtimeModule
├── GameModule → RealtimeModule
├── MatchmakingModule → GameModule → RealtimeModule
└── RealtimeModule → PrismaModule (leaf)
```

If you find yourself writing `forwardRef(...)`, stop and ask: which module should actually own this emission?

Established in spec 008 (`context/spec/008-backend-dx/`).

## 9. Dev Workflow _[Confirmed]_

_Established in spec 009 (`context/spec/009-dev-db-isolation/`)._

### Two Databases, One Postgres Container

The project runs two logical databases in a single Docker Postgres container:

- **`yanchess`** — the dev-API database. Populated by `seed:dev`; mutated freely during manual testing.
- **`yanchess_test`** — e2e scratch database. Wiped and re-seeded by the test harness on every run. Never touched by the dev-API.

This separation ensures `pnpm --filter api test:e2e` is always safe to run without destroying dev data.

### Environment Variables

| Variable             | Used by                                 | Default / required                                                                                       |
| -------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | dev-API (NestJS app, Prisma migrations) | **Required** — set in `apps/api/.env`                                                                    |
| `DATABASE_URL_TEST`  | e2e test harness (`env-setup.ts`)       | Optional; defaults to `postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public`        |
| `REDIS_URL_TEST`     | e2e test harness                        | Optional; defaults to `redis://localhost:6379/1`                                                         |

### Day-One Setup

```bash
docker-compose up -d                          # start Postgres + Redis
pnpm install                                  # install all workspace deps
pnpm --filter api prisma:migrate:deploy       # apply migrations to dev DB
pnpm --filter api db:setup:test               # create yanchess_test + apply migrations
pnpm --filter api seed:dev                    # alice / bob / charlie + ratings + friendship
pnpm dev                                      # start all apps in watch mode
```

### Everyday Workflow

- `pnpm --filter api test:e2e` — safe anytime; operates on `yanchess_test` only.
- `pnpm --filter api seed:dev` — re-establishes alice/bob/charlie + the alice↔bob friendship without touching other dev data (idempotent upserts).

### After a Prisma Migration

Run `pnpm --filter api db:migrate:test` to apply new migrations to `yanchess_test` and keep the test schema in sync with dev.

### Closed Decisions

- **Server-side Stockfish vs WASM** — _closed 2026-10-10 in favor of a WASM client (spec 005)._ Training games do not affect rating and are not persisted, so no server resources are needed for the bot. See §1 Chess AI.
- **Rating: Glicko-2 vs classical ELO** — _closed 2026-10-10 in favor of classical ELO (spec 004)._ K=32 for a player's first 30 games in a mode, K=16 after. The `rd/volatility` fields in `RatingByMode` are kept for a future migration to Glicko-2 but are not used today.
