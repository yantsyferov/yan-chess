# Technical Specification: Production deployment — Fly.io stack

- **Functional Specification:** `context/spec/011-production-deployment/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

Infra-only spec. Two Dockerfiles, two `fly.toml` files, one new `ResendMailer` class in the existing env-branched mail module, one `.env.example` template, and a short deployment runbook in `architecture.md`. **Zero changes to game, auth, or Prisma logic.**

**Key insight from codebase audit:**
- CORS already reads `process.env.WEB_URL` with localhost fallback (main.ts + both gateways). Changing production CORS = `fly secrets set WEB_URL=https://yanchess.fly.dev`. No code change.
- Mail module already env-branches on `MAIL_DRIVER` — currently both branches return `DevOutboxMailer`. We add a `ResendMailer` and wire the `resend` branch.
- Web app reads `VITE_API_URL` from Vite env (4 call sites, all with localhost fallback). Vite bakes env vars at build time → injected via Docker build ARG.

**New runtime pieces:**
- `apps/api/Dockerfile` — multi-stage Node + pnpm + Prisma generate + SWC build.
- `apps/web/Dockerfile` — multi-stage Node build + Caddy static server (automatic SPA fallback via `try_files`).
- `fly.toml` for `yanchess-api` + `fly.toml` for `yanchess`.
- `apps/api/src/modules/mail/resend.mailer.ts` — new provider.
- `.env.example` — documents all required env vars.
- `docs/DEPLOYMENT.md` or appended to `architecture.md §3` — deploy runbook.

**New external dependencies:** `resend` npm package (official SDK, ~50KB).

**Known architectural wrinkle — cross-subdomain cookies:**

Web and API live on different Fly subdomains (`yanchess.fly.dev` vs `yanchess-api.fly.dev`). Current cookies are `SameSite=Lax; Secure=false` for dev. For prod cross-site auth we need:
- Refresh cookie: `SameSite=None; Secure=true; Domain` NOT set (sticks to the API's subdomain).
- Already have `COOKIE_SECURE` env var; add `COOKIE_SAMESITE` env var with values `Lax` (dev) / `None` (prod).

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 API Dockerfile (`apps/api/Dockerfile`)

Multi-stage, `node:22-alpine` base. Shape:

| Stage | Base | Role |
|---|---|---|
| `deps` | `node:22-alpine` | Install pnpm, copy `pnpm-lock.yaml` + `pnpm-workspace.yaml` + root package.json + all `apps/*/package.json` + `packages/*/package.json`, run `pnpm fetch` + `pnpm install --offline --prod=false` (dev deps needed for build) |
| `build` | from `deps` | Copy full monorepo source, `pnpm --filter @yanchess/shared build`, `pnpm --filter api prisma generate`, `pnpm --filter api build` (SWC produces `apps/api/dist/`) |
| `runtime` | `node:22-alpine` | Copy from `build`: `apps/api/dist`, `apps/api/node_modules` (prod-only via `pnpm prune --prod`), `apps/api/prisma`, `apps/api/package.json`, `packages/shared/dist`, `packages/shared/package.json`. ENTRYPOINT runs `node apps/api/dist/main.js`. EXPOSE 3000 |

Prisma migrations run as a Fly release command (see §2.5), NOT in the Dockerfile ENTRYPOINT — this way they run once per deploy, not on every machine restart.

Image size target: < 300 MB.

**Assumption:** `pnpm` version pinned in `packageManager` field of root package.json — Dockerfile reads that to install the matching pnpm.

### 2.2 Web Dockerfile (`apps/web/Dockerfile`)

Multi-stage. Shape:

| Stage | Base | Role |
|---|---|---|
| `deps` | `node:22-alpine` | pnpm fetch, install deps for web + shared |
| `build` | from `deps` | `ARG VITE_API_URL`, `ARG VITE_SENTRY_DSN=` (reserved, empty default — ignored by Vite if unused), run `pnpm --filter @yanchess/shared build && pnpm --filter web build`. Output: `apps/web/dist/` |
| `runtime` | `caddy:alpine` | Copy `apps/web/dist/` → `/srv`. `Caddyfile` serves `/srv` with `try_files {path} /index.html` for SPA fallback. EXPOSE 80 |

**Caddyfile** (minimal, ~5 lines):
```
:80 {
  root * /srv
  try_files {path} /index.html
  file_server
  encode gzip
}
```

**Build-time env vars via `fly.toml`:**

```toml
[build]
  dockerfile = "apps/web/Dockerfile"
  [build.args]
    VITE_API_URL = "https://yanchess-api.fly.dev/api/v1"
```

Baked into bundle. Changing requires a rebuild.

### 2.3 `fly.toml` for API (`apps/api/fly.toml`)

Key config:

| Field | Value | Why |
|---|---|---|
| `app` | `yanchess-api` | Deploy target |
| `primary_region` | `fra` | EU, close to expected users |
| `[build].dockerfile` | `apps/api/Dockerfile` | |
| `[build].ignorefile` | `.dockerignore` | exclude node_modules, dist, tests |
| `[http_service].internal_port` | `3000` | Nest listens on 3000 |
| `[http_service].force_https` | `true` | Fly terminates TLS, forces HTTPS |
| `[http_service].auto_stop_machines` | `"stop"` | Free tier friendly; cold start ~5s |
| `[http_service].auto_start_machines` | `true` | Wakes on first request |
| `[http_service].min_machines_running` | `0` | Allow full idle |
| `[[http_service.checks]]` | path `/api/v1/health`, interval 15s, timeout 5s, grace 10s | Health check for Fly |
| `[[vm]].memory` | `"512mb"` | NestJS + Prisma needs more than 256 |
| `[[vm]].cpu_kind` | `"shared"` | Free tier |
| `[[vm]].cpus` | `1` | |
| `[deploy].release_command` | `pnpm --filter api prisma migrate deploy` | Runs migrations once per deploy, before new machines accept traffic |

**Important:** `release_command` runs in a one-off ephemeral machine with the API image + secrets available. If it fails, deploy aborts and old machines keep serving.

### 2.4 `fly.toml` for Web (`apps/web/fly.toml`)

| Field | Value |
|---|---|
| `app` | `yanchess` |
| `primary_region` | `fra` |
| `[build].dockerfile` | `apps/web/Dockerfile` |
| `[build.args].VITE_API_URL` | `"https://yanchess-api.fly.dev/api/v1"` |
| `[http_service].internal_port` | `80` |
| `[http_service].force_https` | `true` |
| `[http_service].auto_stop_machines` | `"stop"` |
| `[http_service].auto_start_machines` | `true` |
| `[http_service].min_machines_running` | `0` |
| `[[vm]].memory` | `"256mb"` |
| `[[vm]].cpu_kind` | `"shared"` |

### 2.5 Secrets management

Secrets set on `yanchess-api`:

| Secret | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Neon connection string | Prisma + queries |
| `REDIS_URL` | Upstash connection URL (`rediss://...` with TLS) | ioredis + socket.io adapter |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` | Signs access JWTs |
| `JWT_ACCESS_TTL_SEC` | `900` (15 min) | Match dev |
| `REFRESH_TTL_SEC_REMEMBER` | `2592000` (30 days) | Match dev |
| `REFRESH_TTL_SEC_SESSION` | `86400` (24h) | Match dev |
| `WEB_URL` | `https://yanchess.fly.dev` | CORS allow-list + verification email link base |
| `MAIL_DRIVER` | `resend` | Switches to ResendMailer |
| `RESEND_API_KEY` | From Resend dashboard | Sends emails |
| `MAIL_FROM` | `YanChess <onboarding@resend.dev>` (sandbox) OR `YanChess <noreply@verified-domain>` (verified) | Email sender |
| `NODE_ENV` | `production` | Enables prod-only guards |
| `COOKIE_SECURE` | `true` | HTTPS-only refresh cookie |
| `COOKIE_SAMESITE` | `None` | Cross-subdomain cookie allowed |

Secrets set on `yanchess` (web): none at runtime — Vite bakes `VITE_API_URL` at build time.

Set via: `fly secrets set KEY=VALUE --app yanchess-api` per secret. Document in deployment runbook.

### 2.6 Resend mailer

New file: `apps/api/src/modules/mail/resend.mailer.ts`.

Shape:
```ts
@Injectable()
export class ResendMailer implements Mailer {
  private readonly resend: Resend;
  private readonly from: string;
  constructor(private readonly logger: Logger) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    this.resend = new Resend(key);
    this.from = process.env.MAIL_FROM ?? "YanChess <onboarding@resend.dev>";
  }
  async send(msg: Mail): Promise<void> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
    this.logger.log(`Resend emailId=${data.id} to=${msg.to}`);
  }
}
```

`mail.module.ts` branch: `MAIL_DRIVER === "resend" ? ResendMailer : DevOutboxMailer`.

New npm dependency: `resend@^4` in `apps/api/package.json` → ~50KB.

**Known Resend sandbox limit:** without a verified domain, Resend only sends to the account owner's email. For the MVP demo this is fine — the deploying developer registers first and verifies, then invites 2-3 friends by adding them to Resend's recipient allow-list. For broader use, verify a domain (DNS SPF/DKIM records) later.

### 2.7 Cross-subdomain cookie — SameSite=None

Current cookie-setting code (likely in `apps/api/src/modules/auth/auth.service.ts` or a cookie helper) reads `COOKIE_SECURE`. Extend to read `COOKIE_SAMESITE`:

```ts
res.cookie("refreshToken", token, {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase() as "lax" | "strict" | "none",
  path: "/",
  maxAge: ...,
});
```

Grep `res.cookie` and `req.cookies` call sites to confirm one centralized helper exists; if not, add one. For MVP a 2-line change in auth.service.ts is enough.

**Browser semantics:** `SameSite=None` requires `Secure=true`. The combination enables cross-site cookies over HTTPS. Fly enforces HTTPS at the edge so this works end-to-end.

### 2.8 `.env.example` + deployment runbook

New file: `apps/api/.env.example` — lists every env var the API reads, with safe placeholder values and inline comments. One copy of this file replaces the current implicit knowledge of what to set.

Deployment runbook — appended to `context/product/architecture.md §3` or a new `docs/DEPLOYMENT.md` (pick based on existing convention):
- Prerequisite checklist (accounts).
- Secret-set script (one-shot shell block).
- `fly deploy` commands for api + web.
- First-boot smoke steps.
- Rollback procedure (`fly releases list`, `fly releases rollback`).

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Prisma schema** — unchanged. Migrations run as release command.
- **App code (routes, services, sockets)** — unchanged except: (a) new ResendMailer class, (b) cookie options reading COOKIE_SAMESITE, (c) resend package added to deps.
- **Frontend code** — zero changes. VITE_API_URL injection happens at build time via Docker ARG.
- **Local dev workflow (spec 008-010)** — unchanged. MAIL_DRIVER defaults to `outbox` locally; Dockerfiles are only used by deploy; local dev continues to use `pnpm dev`.

### 3.2 Potential Risks & Mitigations

- **Resend sandbox mode blocks sending to arbitrary recipients.** Without a verified domain, Resend returns 403 for recipients outside the owner's email. Mitigation: for demo invite 2-3 specific friends and add them in Resend dashboard. For launch, verify a domain (one-time DNS task, 20 minutes).
- **Fly cold start adds latency.** With `auto_stop_machines` and no min_running, the first visitor after idle hits a ~5s cold boot. Acceptable for demo; shows in acceptance criterion "cold-start under 15s".
- **Cross-subdomain cookie confusion.** If `SameSite=None` isn't honored by a user's browser (e.g., Safari ITP), refresh flow breaks. Mitigation: documented known issue; alternative is to put api behind web via Fly's app-level proxy (bigger refactor). For MVP accept the risk — Chrome/Firefox/Edge handle it fine.
- **Prisma `migrate deploy` failing on release.** If a migration has a bug, release command fails → deploy aborts → old machines keep serving. Mitigation: Fly's intended behavior; the test suite catches most migration bugs during local `prisma migrate dev`.
- **Secrets exposure in Fly dashboard.** Only Fly org owners see secret values. Mitigation: use Fly org access controls; don't invite untrusted collaborators.
- **Image size exceeding Fly limits.** Fly max 8GB. Our target < 300MB. No risk.
- **Caddy on free tier memory.** 256MB is generous for static files. No risk.
- **Neon serverless cold start.** Neon's compute suspends after 5 min idle; first query after takes ~500ms. Mitigation: use their "always-on" option (paid) OR keep traffic warm. For MVP accept the small latency.
- **Upstash command limit.** Free tier 10K commands/day. Each socket operation = 1-5 Redis ops. 10K commands supports ~1000 game actions/day — plenty for demo. If exceeded, upgrade or move Redis.
- **WebSocket upgrades through Fly proxy.** Fly supports this natively via `[http_service]`. Tested by many production apps. Low risk.
- **`.env` file accidentally shipped in Docker image.** Dockerfile uses `.dockerignore` to exclude `.env` + `node_modules` + `dist` from the build context. Important.

### 3.3 Deployment / Runtime impact

- First deploy: estimated 30-45 minutes end-to-end (image build + push + release + smoke).
- Subsequent deploys: ~5 minutes.
- Zero-downtime: Fly rolls machines one at a time; health check gates traffic.
- Rollback: `fly releases rollback` to any prior release.

---

## 4. Testing Strategy

### 4.1 Pre-deploy local verification

- `pnpm --filter api build` + `pnpm --filter web build` from clean state both succeed.
- Dockerfile builds locally: `docker build -t yanchess-api -f apps/api/Dockerfile .` and `docker build -t yanchess-web -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:3000/api/v1 .`.
- Local docker-compose can run the images against local postgres+redis — proves containerization doesn't break the app.

### 4.2 Deploy-time verification

- `fly deploy --app yanchess-api` succeeds, release command runs migrations, machines boot, health check passes.
- `fly deploy --app yanchess` succeeds, static site reachable.
- `curl -sf https://yanchess-api.fly.dev/api/v1/health` → `{"status":"ok"}`.
- `curl -s https://yanchess.fly.dev/` → returns HTML.
- `fly logs --app yanchess-api` shows clean startup (RealtimeModule, FriendsModule, GameModule, "Nest application started", "API listening").

### 4.3 Live user smoke

- Developer registers at `https://yanchess.fly.dev` with their real email.
- Receives verification email from Resend within 30s. Clicks link. Lands on "verified" page.
- Logs in. Plays bot game. Resigns. Rating updates.
- Opens incognito window, registers a second account (from the Resend allow-list). Both users matchmake into Blitz. Game starts. Both make moves. One resigns. Game ends, ratings update.

### 4.4 Regression (not run in prod, run locally)

- All existing test suites still green: `pnpm --filter api test:unit` (92), `pnpm --filter api test:e2e` (76), `pnpm --filter web test -- --run` (278). This spec changes no app logic, so no regression expected.
