# Deployment Runbook

This document is self-contained. Anyone with the required external accounts can deploy YanChess from zero by following the steps below. No prior knowledge of the project's chat history is assumed.

---

## 1. Prerequisites

You need the following external accounts and local tools before starting.

**External accounts:**

- **Fly.io** — https://fly.io — hosts both the API and the web client as Fly apps (`yanchess-api`, `yanchess`).
- **Neon** — https://neon.tech — serverless Postgres. Create a project and copy the **pooled** connection string (PgBouncer, port 6543).
- **Upstash** — https://upstash.com — serverless Redis. Create a database and copy the `rediss://` TLS URL.
- **Resend** — https://resend.com — transactional email (registration, password reset). Create an API key. In sandbox mode only `onboarding@resend.dev` is a valid sender and recipients must be added to your Resend audience manually.

**Local tools:**

```bash
# Install flyctl (macOS / Linux)
curl -L https://fly.io/install.sh | sh

# Verify
fly version
fly auth login   # opens browser — sign in to fly.io
fly auth whoami  # should print your fly.io email
```

---

## 2. One-time setup — first deploy

Work through these steps in order. Each step contains the exact shell command to paste.

### Step 1 — Sanity-check your fly.io identity

```bash
fly auth whoami
```

Expected output: your fly.io email address. If you see an error, run `fly auth login` first.

### Step 2 — Register the API app

```bash
fly launch --no-deploy --copy-config -c fly.api.toml --name yanchess-api --region fra
```

`--no-deploy` registers the app on fly.io without building anything yet. `--copy-config` keeps `fly.api.toml` as-is without prompting for changes.

> **Name conflict:** Fly app names are global. If `yanchess-api` is taken, pick a suffix (e.g. `yanchess-api-prod`) and update the `app` field in `fly.api.toml` accordingly before running this command.

### Step 3 — Set all API secrets

The `--stage` flag writes the secret into Fly's secret store without triggering a machine restart. The secrets are applied atomically on the next `fly deploy`. Generate `JWT_ACCESS_SECRET` inline; for everything else paste your actual values.

```bash
fly secrets set DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech:6543/neondb?sslmode=require&pgbouncer=true" \
  --app yanchess-api --stage

fly secrets set REDIS_URL="rediss://default:xxx@xxx.upstash.io:6379" \
  --app yanchess-api --stage

fly secrets set JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  --app yanchess-api --stage

fly secrets set JWT_ACCESS_TTL_SEC=900 \
  --app yanchess-api --stage

fly secrets set REFRESH_TTL_SEC_REMEMBER=2592000 \
  --app yanchess-api --stage

fly secrets set REFRESH_TTL_SEC_SESSION=86400 \
  --app yanchess-api --stage

fly secrets set WEB_URL="https://yan-chess.com" \
  --app yanchess-api --stage
# (Use https://yanchess.fly.dev if you haven't attached a custom domain yet.
#  WEB_URL is used for CORS allow-list AND as the base for email verification links.)

fly secrets set MAIL_DRIVER=resend \
  --app yanchess-api --stage

fly secrets set RESEND_API_KEY="re_xxxxxxxxxxxx" \
  --app yanchess-api --stage

fly secrets set MAIL_FROM="YanChess <onboarding@resend.dev>" \
  --app yanchess-api --stage

fly secrets set NODE_ENV=production \
  --app yanchess-api --stage

fly secrets set COOKIE_SECURE=true \
  --app yanchess-api --stage

fly secrets set COOKIE_SAMESITE=None \
  --app yanchess-api --stage
```

> **Verified domain:** When you add and verify a sending domain in Resend, change `MAIL_FROM` to `"YanChess <noreply@yourdomain.com>"` (re-run the command without `--stage` so the secret updates immediately).

### Step 4 — Apply Prisma migrations against Neon (one-time)

Fly's `release_command` for Prisma migrations is **currently commented out** in `fly.api.toml` because the production Docker image prunes `pnpm deploy --prod` → the Prisma CLI (a devDep) is not available in the runtime image. Workaround: run migrations manually from your laptop before each deploy that includes a new migration.

```bash
DATABASE_URL="<the exact pooled Neon URL from Step 3>" \
  pnpm --filter api prisma migrate deploy
```

Expected output: Prisma applies pending migrations OR reports `No pending migrations to apply`. See the Common Issues section for the follow-up fix path.

### Step 5 — First API deploy

```bash
fly deploy --app yanchess-api -c fly.api.toml
```

This builds the Docker image from `apps/api/Dockerfile`, pushes it to the Fly registry, boots a new machine, and gates traffic on the `/api/v1/health` check passing.

### Step 6 — Verify the API is healthy

```bash
fly status --app yanchess-api
curl -sf https://yanchess-api.fly.dev/api/v1/health
```

`fly status` should show at least one machine in state `started`. The `curl` should return HTTP 200 with a JSON body like `{"status":"ok"}`. First call may take 5-10 seconds (cold start — `auto_stop_machines` is on by default).

### Step 7 — Register the web app

```bash
fly launch --no-deploy --copy-config -c fly.web.toml --name yanchess --region fra
```

> **Name conflict:** If `yanchess` is taken, pick a suffix (e.g. `yanchess-prod`) and update `app` in `fly.web.toml`. Also update `WEB_URL` in step 3 and the `VITE_API_URL` build arg in `fly.web.toml`.

The web app has **no Fly secrets** — `VITE_API_URL` is baked into the static bundle at build time via the `[build.args]` block in `fly.web.toml`.

### Step 8 — First web deploy

```bash
fly deploy --app yanchess -c fly.web.toml
```

This builds the Vite bundle and bakes `VITE_API_URL` in, then wraps the static output in a Caddy image (not nginx — Caddy's auto SPA fallback is simpler for `try_files {path} /index.html`).

### Step 9 — Verify the web app is up

```bash
curl -sf https://yanchess.fly.dev/
```

Expected: HTTP 200, non-empty HTML.

### Step 10 — Final smoke test

Open https://yanchess.fly.dev/ in a browser. The sign-up form should render. Create a test account and confirm the confirmation email arrives (check the Resend dashboard if it does not).

### Step 11 — (Optional) Attach a custom domain

You can keep the deployment on `*.fly.dev` subdomains, OR point your own domain at it. Fly auto-issues Let's Encrypt TLS certificates for custom domains at no cost.

**For the current prod deployment at `yan-chess.com`, this was done as follows (reproduce for your own domain):**

```bash
# 1. Create certificates in Fly (per app)
fly certs add yan-chess.com --app yanchess
fly certs add api.yan-chess.com --app yanchess-api
# Fly prints DNS records to add — note the A + AAAA values per app.

# 2. In your DNS provider (GoDaddy / Cloudflare / Namecheap / ...), add:
# A    @   → <Fly web shared IP>        (apex points at web)
# AAAA @   → <Fly web shared IPv6>
# A    api → <Fly API shared IP>        (api subdomain points at API)
# AAAA api → <Fly API shared IPv6>
# (DO NOT remove existing MX/TXT/CNAME records from Resend — those are for email.)

# 3. Wait 1-10 min for DNS propagation + Let's Encrypt HTTP-01 challenge
fly certs show yan-chess.com --app yanchess       # until Status=Issued
fly certs show api.yan-chess.com --app yanchess-api

# 4. Update WEB_URL + rebuild web with the new API URL
fly secrets set WEB_URL="https://yan-chess.com" --app yanchess-api
# edit fly.web.toml → [build.args] → VITE_API_URL = "https://api.yan-chess.com/api/v1"
fly deploy -c fly.web.toml --app yanchess
```

The old `*.fly.dev` URLs continue to work in parallel — Fly supports multiple domains per app. Useful for debugging if the custom domain has DNS issues.

---

## 3. Routine deploy — subsequent updates

```bash
git pull

# Redeploy backend only if API code changed:
fly deploy --app yanchess-api -c fly.api.toml

# Redeploy frontend only if web code or VITE_API_URL changed:
fly deploy --app yanchess -c fly.web.toml
```

There is no need to re-run `fly launch` or re-set secrets unless you are adding new secrets or deploying to a brand-new environment.

---

## 4. Rollback

**App rollback** — Fly keeps a history of image versions per app.

```bash
# List recent releases
fly releases list --app yanchess-api

# Roll back to a specific version (e.g. v12)
fly releases rollback v12 --app yanchess-api
```

Run the same commands replacing `yanchess-api` with `yanchess` to roll back the web client.

**Database rollback** — Neon supports point-in-time restore per branch. Open the Neon console → your project → Branches → Restore. Documentation: https://neon.tech/docs/guides/branch-restore

This runbook does not cover data migration rollback. If a `prisma migrate deploy` introduced a breaking schema change, restore the database first, then roll back the app image.

---

## 5. Common issues

**Q: Resend returns 403 / emails are not delivered to real addresses.**

Resend sandbox mode only delivers to addresses you have manually added to your Resend Audience list, and the only valid sender is `onboarding@resend.dev`. To send to arbitrary recipients, **verify a sending domain in the Resend dashboard** (Resend Dashboard → Domains → Add Domain → paste DNS records in your DNS provider → wait for all three records to show green). After verification, change `MAIL_FROM` to a sender on your verified domain:

```bash
fly secrets set MAIL_FROM="YanChess <noreply@yourdomain.com>" --app yanchess-api
```

**The current prod deploy uses `yan-chess.com` as the verified Resend domain**, so sandbox restrictions are no longer in effect for this installation.

---

**Q: The first page load takes 5–10 seconds.**

Both `yanchess-api` and `yanchess` are configured with `auto_stop_machines = "stop"` and `min_machines_running = 0` in their `fly.*.toml` files. Fly stops idle machines to save cost and cold-starts them on the first incoming request. This is expected behaviour, not a bug. To eliminate cold starts, set `min_machines_running = 1` in the relevant toml and redeploy.

---

**Q: Safari users say login does not persist / they are logged out immediately.**

Safari's Intelligent Tracking Prevention (ITP) blocks `SameSite=None` cookies set by a different subdomain. Because `yanchess.fly.dev` (web) and `yanchess-api.fly.dev` (API) are different origins, refresh tokens may not persist in Safari. The current mitigation is to accept this limitation. A future spec will address this by colocating both apps behind a single origin via a reverse proxy.

---

**Q: Where did `release_command` go and how do migrations run?**

The `release_command = "pnpm --filter api prisma migrate deploy"` line in `fly.api.toml` is **commented out** (with a block comment explaining why). The runtime Docker image prunes devDependencies via `pnpm deploy --prod` → the Prisma CLI is NOT in the final image → Fly's release machine can't invoke it. **Current workaround:** run migrations manually from your laptop against the Neon DATABASE_URL before each `fly deploy` that includes a new migration (see Step 4). **Future fix:** either add `prisma` to runtime deps in `apps/api/package.json`, OR install it globally in the Dockerfile runtime stage via `RUN npm install -g prisma@<version>`. After the fix, uncomment the `release_command` line.

---

**Q: `fly deploy` fails on image build with a Prisma binary-target error (`linux-musl-openssl-3.0.x` missing).**

Prisma Client needs an OpenSSL-specific binary that matches the Alpine runtime image. `apps/api/prisma/schema.prisma` has:

```prisma
binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x", "linux-musl-openssl-3.0.x"]
```

Keep all three. `native` is for local Mac dev; `linux-musl-arm64-openssl-3.0.x` + `linux-musl-openssl-3.0.x` are for Fly machines (which may be ARM or x86-64 depending on region + machine size).

---

**Q: `fly launch` says the app name `yanchess` or `yanchess-api` is already taken.**

Fly app names are globally unique across all Fly customers. Add a suffix (e.g. `yanchess-prod`, `yanchess-demo`) and update the `app` field in the corresponding `fly.*.toml` file. For the API, also update the `WEB_URL` secret and the `VITE_API_URL` build arg in `fly.web.toml`.

---

## 6. Current Production Inventory

Concrete values for the YanChess production deployment as of 2026-10-15. Update this section when any value changes (new region, new domain, new provider plan).

### Live URLs

| Role     | Primary (custom domain) | Fallback (Fly default) |
| -------- | ----------------------- | ---------------------- |
| Web      | https://yan-chess.com   | https://yanchess.fly.dev |
| API      | https://api.yan-chess.com | https://yanchess-api.fly.dev |
| Health   | https://api.yan-chess.com/api/v1/health → `{"status":"ok"}` | — |

Both custom and `.fly.dev` URLs route to the same Fly machines. Fly supports multiple domains per app natively.

### Domain

- **Registered:** `yan-chess.com` at **GoDaddy** (approx €10/year, auto-renew OFF — manual renewal expected before expiry)
- **DNS management:** GoDaddy (Resend added its records via its auto-connect OAuth flow)
- **DNS records currently in zone:**

| Type  | Name              | Value / target                                  | Owner  |
| ----- | ----------------- | ----------------------------------------------- | ------ |
| A     | `@`               | `66.241.125.117`                                | Fly (web) |
| AAAA  | `@`               | `2a09:8280:1::1b8:32c9:0`                       | Fly (web) |
| A     | `api`             | `66.241.125.252`                                | Fly (API) |
| AAAA  | `api`             | `2a09:8280:1::1b8:32c5:0`                       | Fly (API) |
| MX    | `send`            | `feedback-smtp.eu-west-1.amazonses.com` (prio 10) | Resend |
| TXT   | `send`            | `v=spf1 include:amazonses.com ~all`             | Resend (SPF) |
| TXT   | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEB...` (DKIM public key) | Resend |
| TXT   | `_dmarc`          | `v=DMARC1; p=none;`                             | Resend |

### TLS

- **Issuer:** Let's Encrypt (via Fly's built-in cert manager)
- **Issued for:** `yan-chess.com` + `api.yan-chess.com` (ECDSA)
- **Lifetime:** 90 days, Fly auto-renews
- **Check status:** `fly certs show yan-chess.com --app yanchess`

### Fly.io

- **Account:** `<owner-email>`
- **Organization:** `personal`
- **Region:** `fra` (Frankfurt) — single region
- **Apps:**

| App             | Purpose              | Dockerfile                     | VM size        | Replicas | Auto-stop |
| --------------- | -------------------- | ------------------------------ | -------------- | -------- | --------- |
| `yanchess-api`  | NestJS API           | `apps/api/Dockerfile`          | shared-cpu 512MB | 1 (HA off) | yes |
| `yanchess`      | Caddy static (SPA)   | `apps/web/Dockerfile`          | shared-cpu 256MB | 2 (HA default) | yes |

- **Fly dashboard:** https://fly.io/apps/yanchess-api + https://fly.io/apps/yanchess
- **Secrets on `yanchess-api` (13 total):** `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SEC`, `REFRESH_TTL_SEC_REMEMBER`, `REFRESH_TTL_SEC_SESSION`, `WEB_URL`, `MAIL_DRIVER`, `RESEND_API_KEY`, `MAIL_FROM`, `NODE_ENV`, `COOKIE_SECURE`, `COOKIE_SAMESITE`
- **Secrets on `yanchess` (web):** none at runtime — `VITE_API_URL` is baked at build time via `fly.web.toml → [build.args]`

### Neon (Managed Postgres)

- **Account:** `<owner-email>`
- **Project:** `yanchess`
- **Region:** `eu-west-2` (London, AWS)
- **Database:** `neondb`
- **Connection:** pooled (PgBouncer-equivalent on port 6543) over TLS with channel binding required
- **Plan:** free tier (0.5 GB storage, serverless auto-pause after 5 min idle → ~500ms cold start on first query after pause)
- **Branches:** `main` only
- **Dashboard:** https://console.neon.tech
- **Migrations applied (6 of 6, verified live):** `init_auth`, `add_email_verification_tokens`, `add_ratings_by_mode`, `add_password_reset_tokens`, `add_game`, `add_friendship`

### Upstash (Managed Redis)

- **Account:** `<owner-email>`
- **Database name:** `helped-giraffe-155808`
- **Region:** EU (same AZ family as Fly `fra` — low latency)
- **Protocol:** Redis TCP over TLS (`rediss://` on port 6379). NOT the REST API — the API uses the TCP connection for ioredis + Socket.IO adapter.
- **Plan:** free tier (10K commands/day, 256 MB storage, max 100 concurrent connections)
- **Dashboard:** https://console.upstash.com

### Resend (Transactional Email)

- **Account:** `<owner-email>`
- **Verified sending domain:** `yan-chess.com` (SPF + DKIM + DMARC all verified)
- **Sender address in use:** `YanChess <noreply@yan-chess.com>`
- **Plan:** free tier (3,000 emails/month, 100/day)
- **API key naming:** `yanchess-prod` (sending access, all domains)
- **Dashboard:** https://resend.com

### Known operational constraints

1. **Prisma migrations not auto-applied by Fly.** `release_command` is commented out in `fly.api.toml` because Prisma CLI is pruned from the runtime image. Run `pnpm --filter api prisma migrate deploy` from laptop against the Neon URL before deploying any migration-bearing release. See the matching Common Issues entry for the fix path.
2. **Single-region deployment.** All compute, DB, and Redis in EU. US / APAC users will see higher latency. Fix: deploy additional Fly machines in `iad` / `syd` regions (requires Neon multi-region + Upstash global DB — paid plans).
3. **Cold start on first visit after idle.** `auto_stop_machines = "stop"` + `min_machines_running = 0` on both apps saves money but costs ~5-10 seconds on the first request after a quiet period. Set `min_machines_running = 1` to eliminate.
4. **Safari cross-subdomain cookies.** `SameSite=None` cookies between `yan-chess.com` and `api.yan-chess.com` may be blocked by Safari ITP. Chrome / Firefox / Edge work fine. Fix (future spec): colocate web + API behind a reverse proxy so they share origin.
5. **No automated backups beyond Neon's point-in-time restore.** Neon's free tier provides 24h PITR; Upstash provides snapshot-based backup. No off-platform mirror.

### Account access (recovery info)

If the person who deployed loses access to any provider, the paths to regain control:

- **Fly.io:** account recovery via `<owner-email>`. Each app's secrets are only visible to org members.
- **Neon / Upstash / Resend:** same email account. Each provider has standard "forgot password" via that email.
- **GoDaddy:** domain is registered to the GoDaddy account on `<owner-email>`. If the account is lost, the domain is lost — GoDaddy enforces 60-day transfer locks on new registrations, so for the first 60 days the domain cannot be moved to another registrar even with the auth code.
