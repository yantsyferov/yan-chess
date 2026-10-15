# YanChess API — Backend Context

NestJS 10 + Prisma 5 + Socket.IO + ioredis. See repo root `CLAUDE.md` for project-wide conventions and the hard rule list.

---

## Module layout

Each feature lives under `src/modules/<feature>/`. Typical files: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.gateway.ts` (if WebSocket), `dto/`.

Current modules (grep `app.module.ts` for current list):

| Module          | Role                                                            |
| --------------- | --------------------------------------------------------------- |
| `auth`          | Register, login, refresh, email verify, password reset — JWT + Redis refresh tokens |
| `prisma`        | PrismaService (global) + PrismaModule                           |
| `redis`         | ioredis singleton (`RedisService`)                              |
| `realtime`      | **`RealtimeEmitter` + `PresenceService`** — see below           |
| `game`          | `GameService`, `GameGateway` (namespace `/play`), `FlagSweepWorker` |
| `matchmaking`   | Queue + pairing — `@Global()` module to break the game ↔ matchmaking cycle at module level without `forwardRef` |
| `friends`       | REST + `FriendsGateway` (namespace `/friends`) + `ChallengeService` + `ChallengeExpirySweeper` |
| `game-history`  | List + replay endpoints (spec 006)                              |
| `mail`          | `Mailer` interface + env-branched provider (`DevOutboxMailer` / `ResendMailer`) |
| `rating`        | ELO K=32→16 calculation (spec 004)                              |
| `tokens`        | JWT verifier used by WsJwtGuard + JwtAuthGuard                  |
| `users`         | `/users/me` + profile endpoints                                 |

---

## Realtime pattern — CRITICAL (spec 008)

**Services never inject gateways. Gateways never inject services from other feature modules.**

To emit a socket event or check presence, inject `RealtimeEmitter` (and optionally `PresenceService`) from `RealtimeModule`.

```ts
import { RealtimeEmitter } from "../realtime/realtime-emitter";

@Injectable()
export class MyFeatureService {
  constructor(private readonly realtime: RealtimeEmitter) {}
  async notify(userId: string): Promise<void> {
    this.realtime.toUser(userId, "friends").emit("my.event", { ok: true });
    // or: this.realtime.toRoom("play", `game:${gameId}`).emit("game.state", payload);
  }
}
```

**`RealtimeEmitter` methods:** `register(namespace, server)` (gateways call in `afterInit`), `toRoom(namespace, room)`, `toUser(userId, namespace)`, `socketCount(userId)`.

**Namespaces:** `play` (GameGateway) and `friends` (FriendsGateway). Each gateway registers itself in `afterInit`.

If you ever find yourself writing `forwardRef(...)`, STOP — the dependency belongs elsewhere. See `context/product/architecture.md §8` + `context/spec/008-backend-dx/`.

---

## Prisma

- Schema: `prisma/schema.prisma`. 6 models (`User`, `RatingByMode`, `EmailVerificationToken`, `PasswordResetToken`, `Game`, `Friendship`) + 3 enums.
- `binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x", "linux-musl-openssl-3.0.x"]` — the two Alpine targets are for Docker/Fly deploy; dropping either breaks prod boot (spec 011).
- Migrations live at `prisma/migrations/`. Current count: 6 (grep `ls prisma/migrations/`).
- Dev: `pnpm --filter api prisma:migrate:dev` creates + applies. Prod: `prisma:migrate:deploy` applies only.
- **Known issue:** Prisma CLI is a devDep. The runtime Docker image strips devDeps via `pnpm deploy --prod`, so **Fly `release_command` can't call it**. Migrations run manually from laptop against the Neon URL before each prod deploy. See `fly.api.toml` comment block above `[deploy]`.

---

## Env vars

See `.env.example` for the full list with inline comments. Key env vars by concern:

| Concern         | Vars                                                     |
| --------------- | -------------------------------------------------------- |
| **Database**    | `DATABASE_URL` (dev), `DATABASE_URL_TEST` (e2e override) |
| **Redis**       | `REDIS_URL` (dev DB 0), `REDIS_URL_TEST` (e2e DB 1)      |
| **JWT**         | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SEC`, `REFRESH_TTL_SEC_REMEMBER`, `REFRESH_TTL_SEC_SESSION` |
| **CORS + mail links** | `WEB_URL`                                          |
| **Mail**        | `MAIL_DRIVER` (`outbox` / `resend`), `RESEND_API_KEY`, `MAIL_FROM` |
| **Cookies**     | `COOKIE_SECURE`, `COOKIE_SAMESITE` (spec 011)            |
| **Runtime**     | `NODE_ENV`, `PORT`                                       |

Secrets never go in git. Prod uses `fly secrets set --app yanchess-api`.

---

## Redis key namespaces

| Prefix                       | Owner           | Purpose                                   |
| ---------------------------- | --------------- | ----------------------------------------- |
| `session:{token}`            | auth            | Refresh token sessions                    |
| `user:sessions:{userId}`     | auth            | Session index per user                    |
| `rl:{key}`                   | auth            | Rate limiter buckets                      |
| `mm:*`                       | matchmaking     | Queue sorted sets per mode                |
| `game:{gameId}`              | game            | Active game state (position, clocks)      |
| `game:{gameId}:moves`        | game            | SAN move list                             |
| `game:active`                | game            | Set of active game ids (for sweeper)      |
| `user:activeGame:{userId}`   | game            | User → current game id (prevents double-queue) |
| `rematch:{gameId}`           | game            | Pending rematch offers                    |
| `challenge:{challengeId}`    | friends         | Challenge state hash                      |
| `user:activeChallenge:{userId}` | friends      | User → outbound challenge id              |
| `challenge:active`           | friends         | Set of active challenges (for sweeper)    |

E2E tests set DB index 1 via `env-setup.ts` — their `resetAll` clears these patterns in DB 1 only, dev state in DB 0 is untouched (spec 009).

---

## Mail module

Interface in `src/modules/mail/mail.service.ts`. Factory in `mail.module.ts` branches on `MAIL_DRIVER`:

- `outbox` (dev default) → `DevOutboxMailer` writes JSON files to `apps/api/dev-outbox/*.json`. Convenient for test inspection.
- `resend` (prod) → `ResendMailer` calls Resend SDK with `MAIL_FROM` as sender.

`AuthService` always calls `this.mailService.send({ to, subject, html, token })`. The `token` field is dev-only metadata; `ResendMailer` ignores it.

Prod sender: `YanChess <noreply@yan-chess.com>` (Resend domain verified in spec 011).

---

## Cookie options

Set in `auth.controller.ts` on login + refresh (grep `res.cookie("refreshToken"`). Three env-driven flags:

- `secure: process.env.COOKIE_SECURE === "true"` — `false` in dev, `true` in prod.
- `sameSite: (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase()` — `lax` in dev, `None` in prod (cross-subdomain `yan-chess.com` ↔ `api.yan-chess.com` requires `None + Secure`).
- `httpOnly: true` always.

---

## Dev loop

- **Preferred:** `pnpm dev` from repo root — concurrently starts shared watcher + api + web.
- **API only:** `pnpm --filter api dev` — concurrently starts shared watcher + `nest start --watch`. SWC builder, incremental compile ~4ms (spec 008).
- **Rebuild + run from dist:** `pnpm --filter api build && node apps/api/dist/main.js`. This is how prod runs.
- **Dev-API is the long-running process on port 3000.** Keep it alive during work. Only kill it when running `test:e2e` (which spawns its own API). After e2e, restart via `cd apps/api && node dist/main.js > /tmp/dev-api.log 2>&1 &`.
- **Reset dev state:** `pnpm --filter api seed:dev` restores alice/bob/charlie + alice-bob friendship (spec 009). Idempotent, safe to run anytime.

---

## Testing

- Unit: `pnpm --filter api test:unit` — Vitest, uses hand-rolled stubs (no vitest-mock-extended). ~95 tests.
- E2E: `pnpm --filter api test:e2e` — Vitest, Supertest for HTTP, socket.io-client for sockets. Isolated test DB. ~76 tests.
- Setup file: `test/e2e/env-setup.ts` runs via Vitest `setupFiles` and overrides `DATABASE_URL` + `REDIS_URL` BEFORE any test module loads. Don't move this to a regular import — timing breaks (spec 009).
- Reset helper: `test/e2e/setup.ts → resetAll` truncates `users` CASCADE + clears Redis patterns listed above.

---

## Deployment

Prod: `fly deploy -c fly.api.toml --app yanchess-api` from repo root. Full runbook: `docs/DEPLOYMENT.md`.

Build context is **repo root** (Dockerfile at `apps/api/Dockerfile` references the whole monorepo for `pnpm fetch` + workspace deps). `fly.api.toml` lives at root as `fly.api.toml` (not under `apps/api/`) because of this.
