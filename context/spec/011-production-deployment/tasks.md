# Tasks: Production deployment

Spec: `context/spec/011-production-deployment/`

Vertical slices — each one leaves the project in a reproducible, deployable state with more infrastructure proven out. Specs 001-010 must stay fully functional locally after every slice (76 e2e + 92 unit + 278 web tests green at every checkpoint).

**Prerequisites for Slice 6+ (user owns, confirm before invoking /awos:implement on those slices):**
- Fly.io account; `flyctl` installed; `fly auth whoami` returns logged-in user.
- Neon account with a Postgres project; connection string in hand.
- Upstash account with a Redis instance; `rediss://` URL in hand.
- Resend account; API key in hand; sandbox-mode-OK sender address (`onboarding@resend.dev`) OR a verified domain.
- A real email address the developer can check (for the Slice 7 live smoke).

---

- [x] **Slice 1: API Dockerfile — buildable and runnable locally**

  Minimum visible value: a developer runs `docker build -f apps/api/Dockerfile -t yanchess-api .` from repo root and gets a working image. Starting that image against a local Postgres+Redis boots the API, migrations apply, health check returns 200. No deploy yet — just proves the container runs correctly.

  - [x] Create `apps/api/Dockerfile` per technical-considerations §2.1: 3-stage (deps, build, runtime) with `node:22-alpine` base. Deps stage uses `pnpm fetch` + `pnpm install --offline --prod=false`. Build stage runs `pnpm --filter @yanchess/shared build`, `pnpm --filter api prisma generate`, `pnpm --filter api build`. Runtime stage copies `apps/api/dist`, `apps/api/node_modules` (prod-pruned), `apps/api/prisma`, `apps/api/package.json`, `packages/shared/dist`, `packages/shared/package.json`. `EXPOSE 3000`. `CMD ["node", "apps/api/dist/main.js"]`. Prisma migrations do NOT run in CMD — they run via Fly `release_command` later (Slice 6). **[Agent: cloud-infra]**
  - [x] Create `.dockerignore` at repo root. Must exclude: `node_modules/`, `**/dist/`, `**/.env`, `**/.env.local`, `**/.env.test`, `.git/`, `**/*.log`, `apps/api/dev-outbox/`, `.playwright-mcp/`, `docs/screenshots/`, `context/`, `.awos/`. Preserve `packages/*/package.json` and `apps/*/package.json` — they're needed for `pnpm fetch`. **[Agent: cloud-infra]**
  - [x] Verify: Build + boot locally.
    1. Run `docker build -f apps/api/Dockerfile -t yanchess-api:verify .` from repo root. Confirm exit 0 within 5 minutes. Report image size via `docker images yanchess-api:verify` — must be ≤ 400MB.
    2. The user's dev-API runs on port 3000; the test container needs a different port. Run:
       ```
       docker run --rm -d --name yanchess-api-verify --network host \
         -e DATABASE_URL="postgresql://yanchess:yanchess@localhost:5432/yanchess?schema=public" \
         -e REDIS_URL="redis://localhost:6379/2" \
         -e JWT_ACCESS_SECRET="verify-only-not-prod" \
         -e JWT_ACCESS_TTL_SEC=900 \
         -e REFRESH_TTL_SEC_REMEMBER=2592000 \
         -e REFRESH_TTL_SEC_SESSION=86400 \
         -e WEB_URL="http://localhost:5173" \
         -e MAIL_DRIVER="outbox" \
         -e COOKIE_SECURE=false \
         -e NODE_ENV=production \
         -e PORT=3001 \
         yanchess-api:verify
       ```
       (Port 3001 to avoid collision with the user's dev-API on 3000. Redis DB 2 to avoid colliding with dev-API's DB 0 or e2e's DB 1. If PORT env var isn't honored by main.ts, note it and bind port 3000 inside the container to host 3001 instead.)
    3. Wait 5s. Check `docker logs yanchess-api-verify 2>&1 | tail -20` — must show `Nest application successfully started` + `API listening`.
    4. `curl -sf http://localhost:3001/api/v1/health` → `{"status":"ok"}` (or whatever host:port maps).
    5. `docker stop yanchess-api-verify` + `docker rmi yanchess-api:verify`.
    6. Report image size + container start time. **[Agent: cloud-infra]**

- [x] **Slice 2: Web Dockerfile — buildable and runnable locally**

  Minimum visible value: `docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:3001/api/v1 -t yanchess-web .` succeeds. Running the image serves the SPA on port 80, SPA fallback (`/friends` → `/index.html`) works.

  - [x] Create `apps/web/Dockerfile` per technical-considerations §2.2: 3-stage, Caddy as runtime. Build stage accepts `ARG VITE_API_URL`. Runtime stage `caddy:alpine` copies `apps/web/dist/` to `/srv`, has a Caddyfile that serves it with `try_files {path} /index.html`. `EXPOSE 80`. **[Agent: cloud-infra]**
  - [x] Create `apps/web/Caddyfile` (minimal 5-line config per technical-considerations §2.2). **[Agent: cloud-infra]**
  - [x] Verify: Build + serve.
    1. `docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:3001/api/v1 -t yanchess-web:verify .`. Exit 0 within 3 minutes. Report image size — must be ≤ 100MB (Caddy is ~40MB).
    2. `docker run --rm -d --name yanchess-web-verify -p 8080:80 yanchess-web:verify`.
    3. `curl -sf http://localhost:8080/` → HTML containing `<div id="root"></div>` and `<script` referencing a hashed bundle in `/assets/`.
    4. `curl -sf http://localhost:8080/friends` → same HTML (SPA fallback worked — React Router does the rest client-side).
    5. `curl -sf http://localhost:8080/assets/<any-bundle>` → JS/CSS content with `content-type` + gzip encoding.
    6. Grep the main bundle for the baked-in API URL: `curl -s http://localhost:8080/assets/<main-js> | grep -o 'localhost:3001'` — must find it (proves `VITE_API_URL` was baked at build time).
    7. `docker stop yanchess-web-verify` + `docker rmi yanchess-web:verify`. **[Agent: cloud-infra]**

- [x] **Slice 3: Code changes — ResendMailer + cookie SameSite + .env.example**

  Minimum visible value: setting `MAIL_DRIVER=resend RESEND_API_KEY=re_xxx` locally and registering a new user actually sends an email via Resend (if the key is valid). The refresh-token cookie now supports `COOKIE_SAMESITE=None` for cross-site production. A new `.env.example` documents every env var.

  - [x] Install `resend@^4` in `apps/api`: `pnpm --filter api add resend@^4`. **[Agent: nestjs-backend]**
  - [x] Create `apps/api/src/modules/mail/resend.mailer.ts` per technical-considerations §2.6. Class implements the existing `Mailer` interface. Constructor reads `RESEND_API_KEY` (throws if missing) + `MAIL_FROM` (defaults to `"YanChess <onboarding@resend.dev>"`). `send({to, subject, html, token})` calls `resend.emails.send({ from, to, subject, html })`. On error throws `Error("Resend send failed: " + error.message)`. **[Agent: nestjs-backend]**
  - [x] Extend `apps/api/src/modules/mail/mail.module.ts` to wire the new provider: when `MAIL_DRIVER === "resend"`, provide `ResendMailer`; otherwise `DevOutboxMailer`. **[Agent: nestjs-backend]**
  - [x] Add `COOKIE_SAMESITE` env var support in cookie-setting code. Grep `res.cookie("refreshToken", ...)` under `apps/api/src/`. Where it reads `secure: process.env.COOKIE_SECURE === "true"`, add `sameSite: (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase() as "lax" | "strict" | "none"`. Preserve all existing cookie options. **[Agent: nestjs-backend]**
  - [x] Create `apps/api/.env.example` listing every env var the API reads with inline comments:
    - `DATABASE_URL` — Postgres connection, e.g. `postgresql://yanchess:yanchess@localhost:5432/yanchess?schema=public`
    - `REDIS_URL` — Redis URL, e.g. `redis://localhost:6379` (prod uses `rediss://...upstash.io:6379`)
    - `JWT_ACCESS_SECRET` — ≥48 random bytes, DO NOT commit to repo
    - `JWT_ACCESS_TTL_SEC` — e.g. `900`
    - `REFRESH_TTL_SEC_REMEMBER` — e.g. `2592000` (30d)
    - `REFRESH_TTL_SEC_SESSION` — e.g. `86400` (1d)
    - `WEB_URL` — for CORS + email link base, e.g. `http://localhost:5173` (prod `https://yanchess.fly.dev`)
    - `MAIL_DRIVER` — `outbox` (dev) or `resend` (prod)
    - `RESEND_API_KEY` — required only when `MAIL_DRIVER=resend`
    - `MAIL_FROM` — e.g. `"YanChess <onboarding@resend.dev>"`
    - `COOKIE_SECURE` — `false` (dev) / `true` (prod)
    - `COOKIE_SAMESITE` — `lax` (dev) / `none` (prod cross-site)
    - `NODE_ENV` — `development` or `production`
    - `PORT` — defaults to 3000 if unset. **[Agent: nestjs-backend]**
  - [x] Add unit test `apps/api/test/unit/resend-mailer.spec.ts` with mocked `resend` SDK: assert constructor throws on missing `RESEND_API_KEY`, assert `send()` calls `resend.emails.send` with the right shape, assert `send()` surfaces the SDK's error. Use `vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }))`. **[Agent: nestjs-backend]**
  - [x] Verify: `pnpm --filter api typecheck` passes. `pnpm --filter api test:unit` passes (≥92 before + 2-3 new tests). `pnpm --filter api test:e2e` passes (76 unchanged). `pnpm --filter web test -- --run` passes (278 unchanged, no frontend changes). **[Agent: nestjs-backend]**

- [x] **Slice 4: `fly.toml` configs for api + web (lint-validated locally)**

  Minimum visible value: `fly config validate` succeeds for both apps. No deploy yet, but the config files are complete and reviewable.

  - [x] Create `apps/api/fly.toml` **(placed at repo root as `fly.api.toml` instead — Fly build context constraint, documented in impl report)** per technical-considerations §2.3. Must contain all listed fields: `app`, `primary_region = "fra"`, `[build].dockerfile`, `[http_service]` with port 3000 and health check, `[deploy].release_command`, `[[vm]]` with 512mb. **[Agent: cloud-infra]**
  - [x] Create `apps/web/fly.toml` **(placed at repo root as `fly.web.toml` — same reason as api)** per technical-considerations §2.4. Must contain `app = "yanchess"`, `primary_region = "fra"`, `[build].dockerfile = "apps/web/Dockerfile"`, `[build.args].VITE_API_URL = "https://yanchess-api.fly.dev/api/v1"`, `[http_service]` with port 80, `[[vm]]` with 256mb. **[Agent: cloud-infra]**
  - [x] Verify: `fly config validate -c apps/api/fly.toml` → OK. `fly config validate -c apps/web/fly.toml` → OK. If `flyctl` is not installed on the running machine, skip the validate step but confirm the files parse as TOML (`python3 -c "import tomllib; tomllib.loads(open('apps/api/fly.toml').read())"` and same for web). **[Agent: cloud-infra]**

- [x] **Slice 5: Deployment runbook**

  Minimum visible value: a new developer with the external accounts in hand can follow a single doc to deploy from zero. Covers the exact commands + rollback procedure.

  - [x] Create `docs/DEPLOYMENT.md` with sections:
    - Prerequisites (link to Fly / Neon / Upstash / Resend sign-up).
    - "First deploy" step-by-step: `fly launch --no-deploy` for api + web, `fly secrets set ...` for each secret (concrete commands with placeholder values), `fly deploy --app yanchess-api`, `fly deploy --app yanchess`, verification `curl` commands.
    - "Routine deploy" condensed: `git pull && fly deploy --app yanchess-api && fly deploy --app yanchess`.
    - "Rollback": `fly releases list` + `fly releases rollback <version>`.
    - "Common issues" (3-5 known gotchas): Resend sandbox blocks unknown recipients, cold start latency, cross-subdomain cookie Safari ITP note. **[Agent: cloud-infra]**
  - [x] Append brief "Production deployment" paragraph to `context/product/architecture.md` §3 (just a pointer: "see docs/DEPLOYMENT.md for the full runbook", lists stack: Fly compute + Neon PG + Upstash Redis + Resend email + Caddy static). Mark `_[Confirmed]_` with reference to spec 011 once deploy is actually live. For now, leave as `_[Assumption]_` — will flip in /awos:verify. **[Agent: cloud-infra]**
  - [x] Verify: doc exists, grep `grep -c "fly secrets set" docs/DEPLOYMENT.md` → ≥10 (one per secret). grep `grep -c "fly deploy" docs/DEPLOYMENT.md` → ≥2. **[Agent: cloud-infra]**

- [x] **Slice 6: First deploy — API + web live on `*.fly.dev`**

  Minimum visible value: `curl https://yanchess-api.fly.dev/api/v1/health` returns `{"status":"ok"}` AND `curl https://yanchess.fly.dev/` returns the SPA HTML. Nothing user-facing works yet (email not tested, auth not tested — Slice 7 does that), but the infrastructure is live.

  **Prerequisites (BLOCKING — must be confirmed before this slice runs):**
  - User has created the four external accounts.
  - User provides each secret value to the implementer agent via a secure channel (direct chat; agent uses them in `fly secrets set` and does NOT write them to any file).
  - `flyctl` is installed on the developer machine where /awos:implement runs.

  - [x] Agent asks user to confirm prerequisites via `AskUserQuestion` with 2 options: "All 4 accounts ready, flyctl installed, I'll paste secret values when prompted" / "Not yet — stop and let me finish setup first". If "Not yet", stop the slice; the loop will not advance. **[Agent: cloud-infra]**
  - [x] Run `fly launch --no-deploy --copy-config -c apps/api/fly.toml --name yanchess-api --region fra` to register the app with Fly without deploying yet. If the app name is taken, agent asks user for an alternate name via AskUserQuestion and updates fly.toml. **[Agent: cloud-infra]**
  - [x] Agent prompts user via `AskUserQuestion` for each secret value one at a time (user pastes, agent runs `fly secrets set KEY=value --app yanchess-api --stage` for each; `--stage` means secrets don't take effect until next deploy — safer). Secrets: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (agent can generate via `openssl rand -base64 48` if user prefers), `JWT_ACCESS_TTL_SEC=900`, `REFRESH_TTL_SEC_REMEMBER=2592000`, `REFRESH_TTL_SEC_SESSION=86400`, `WEB_URL=https://yanchess.fly.dev`, `MAIL_DRIVER=resend`, `RESEND_API_KEY`, `MAIL_FROM`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=None`. **[Agent: cloud-infra]**
  - [x] Deploy API: `fly deploy --app yanchess-api --config apps/api/fly.toml`. On success, release command runs `prisma migrate deploy` against the Neon DB, then new machines boot. Verify: `fly status --app yanchess-api` shows machine state "started" + "passing" health check. `curl -sf https://yanchess-api.fly.dev/api/v1/health` → `{"status":"ok"}`. If deploy fails, capture `fly logs --app yanchess-api | tail -40` and surface the error to the user. **[Agent: cloud-infra]**
  - [x] Register web app with Fly: `fly launch --no-deploy --copy-config -c apps/web/fly.toml --name yanchess --region fra`. **[Agent: cloud-infra]**
  - [x] Deploy web: `fly deploy --app yanchess --config apps/web/fly.toml`. Verify: `curl -sf https://yanchess.fly.dev/` returns HTML containing `<div id="root"></div>`. `curl -s https://yanchess.fly.dev/assets/<any-main-bundle>` returns JS. Grep the bundle for `yanchess-api.fly.dev` to confirm `VITE_API_URL` was baked correctly. **[Agent: cloud-infra]**
  - [x] Final verification: open `https://yanchess.fly.dev` in a browser (via Playwright MCP for scripted confirmation OR just curl + eyeball), confirm the sign-up form renders. **[Agent: cloud-infra]**

- [x] **Slice 7: Live end-to-end smoke — real user flow in prod**

  Minimum visible value: a real human can register with a working email, verify, log in, play a bot game, and matchmake with another real human.

  **Prerequisites:**
  - Slice 6 fully green.
  - User has a real email address they can check during this slice (NOT a @test.local — needs to actually receive mail).
  - If Resend is in sandbox mode, the user has added that email to Resend's "verified recipients" list.

  - [x] Playwright MCP smoke on `https://yan-chess.com` (custom domain, not .fly.dev):
    1. Open sign-up form. Register with user-provided email + a password.
    2. Agent asks user via `AskUserQuestion` to check their inbox and confirm the verification email arrived (within 30s), then paste the verification link OR confirm clicking it.
    3. After verification, log in via UI. Reach the home page.
    4. Click "vs Bot", start a bot game, make 2-3 moves. Resign. Confirm game-over screen.
    5. From a SECOND Playwright context (clear cookies), register a second account (user provides a second email OR uses an alias that routes to the same inbox). Verify email. Log in.
    6. Both users click "Find game" in Blitz. Within 10s pair → both navigate to `/play`.
    7. Make a few moves on each side. Alice resigns. Both see game-over.
    8. Confirm rating moved via UI (profile page shows new Blitz rating).
    - **If any step fails:** capture Playwright snapshot + Fly logs, surface to user, do NOT mark this slice done.
    - **If all steps pass:** this is the headline success criterion of the whole spec. **[Agent: general-purpose]**
  - [x] Cleanup after smoke: delete any screenshots created, close Playwright browser. The two user accounts stay in prod (real demo state — that's the point). **[Agent: general-purpose]**

**Phase A PASS end-to-end** on `https://yan-chess.com` (register → Resend email arrived in inbox → verify link → sign-in → bot game → resign → game-over). **Phase B (bob + matchmaking) skipped per user decision** — matchmaking is covered by 76 e2e tests + was manually live-verified during prior dev sessions; re-running in prod with a 2nd browser was nice-to-have, not essential.

- [x] **Slice 8: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read `context/spec/011-production-deployment/functional-spec.md` acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole. For an infrastructure spec most criteria are either (a) already covered by regression (specs 001-010 behavior preserved — just rerun those suites), (b) one-time deployment checks (not meaningful to re-test), or (c) manually-verified live smoke (Slice 7). The new automated tests focus on **what COULD regress** in day-to-day development:
    - Unit for `ResendMailer` — mocked SDK, verify constructor + send() behavior (already added in Slice 3, extend if needed).
    - Unit/integration for the cookie `COOKIE_SAMESITE` env var — assert the cookie options object produced by the login flow carries the right `sameSite` value when the env var is set.
    - Dockerfile smoke test — a vitest that runs `docker build --dry-run` or `docker buildx build --check` to catch Dockerfile syntax regressions. If Docker is unavailable in test env, skip gracefully with `test.skipIf`.
    - fly.toml schema check — a vitest that parses both `fly.toml` files as TOML + asserts required keys exist (`app`, `primary_region`, `[http_service].internal_port`, etc.). Catches drift if someone deletes a key.
    - Mail module driver branching — unit test that `MAIL_DRIVER=resend` returns `ResendMailer`, `MAIL_DRIVER=outbox` returns `DevOutboxMailer`.
    RED validation on the "no mail-driver branching" invariant: temporarily revert `MAIL_DRIVER === "resend"` check in mail.module.ts to always return `DevOutboxMailer`; run that single test; show it fails; restore; show it passes. Annotate each test with `@spec: 011-production-deployment` and `@regression`. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. Also run `pnpm --filter web typecheck`, `pnpm --filter web test -- --run`, `pnpm --filter api typecheck`, `pnpm --filter api test:unit`, `pnpm --filter api test:e2e` to confirm zero regressions in specs 001-010 (76 e2e, 92 unit, 278 web minimum). **[Agent: testing-expert]**
