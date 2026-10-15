# Project Backlog

Centralized list of **known deferred items, operational TODOs, and tracked technical debt** that is NOT currently in a spec but is worth not forgetting. Scattered across spec Change Logs otherwise.

Grouped by "when does this bite?" — fix order should go top to bottom.

Last updated: 2026-10-15. Update this file when a `/awos:verify` surfaces a new deferral, when an audit identifies new debt, or when you resolve an item.

---

## 🔴 Blocks something now (fix before next demo / invite)

### 1. Orphan user `<owner-email>` on prod with unknown password

**Context:** During spec 011 Slice 7 live smoke, the subagent discovered this email was already registered on prod from an earlier `fly deploy` experiment, but `Password123!` returned 401. Worked around by registering alice as `<owner-email with +alice1 alias>` (Gmail `+alias` routes to the same inbox).

**Impact:** If the owner invites real users, this row occupies the primary email. Any register attempt with `<owner-email>` returns 409 `email_already_registered`.

**Fix options:**
- **(a) Delete the row** via Neon console or psql:
  ```sql
  DELETE FROM users WHERE email = '<owner-email>' AND nickname != 'aliceprod1';
  ```
  Fast, destructive. Fine for one orphan row.
- **(b) Use "Forgot password" via UI** → receive reset email → set a known password. Non-destructive, preserves whatever nickname was taken.

Pick **(a)** if you don't care about that account; **(b)** if you want to reclaim the email as a working account.

### 2. GoDaddy domain renewal — `yan-chess.com` expires 2027-10-15

**Context:** During spec 011, domain purchased at GoDaddy for ~€10/year. User explicitly turned off auto-renew during checkout to avoid recurring charges.

**Impact:** If forgotten, the domain lapses → DNS records disappear → `yan-chess.com` + `api.yan-chess.com` + Resend sender all break simultaneously.

**Action:** Add calendar reminder for **2027-09-15** (one month before expiry) to review + renew. Alternatively, re-enable auto-renew in GoDaddy dashboard (safer, costs €10/yr).

### 3. `/vs-bot` route protection drift from spec 005

**Context:** Spec 005 (Play vs Bot) functional-spec implied the training mode is reachable **without authentication** — "training games live in the current tab, are not persisted". But current `apps/web/src/routes.tsx` places `/vs-bot` inside `<AuthenticatedLayout>` (added during spec 007 Slice 7 for the global notification layer).

**Impact:** An anonymous visitor clicking "vs Bot" in the Header is redirected to `/login` instead of landing on the setup screen. Verify-agent in spec 011 Slice 7 noted this.

**Fix options:**
- **(a) Make `/vs-bot` public again** — one-line move in `routes.tsx` out of the `AuthenticatedLayout` tree. Trade-off: the notification layer won't render for anonymous users on `/vs-bot` (which is correct — anonymous users have no friends/challenges).
- **(b) Amend spec 005 functional-spec** to reflect current behavior (bot mode = authenticated-only). Signals an intentional product shift from "training" → "logged-in-only practice".

Needs product decision. Pick **(a)** if bot mode should remain anonymous-accessible per original intent; **(b)** if auth-only is the new intent.

---

## 🟡 Deferred acceptance criteria (explicitly accepted gaps)

Items that were flagged `[ ]` in a functional-spec with a documented reason during `/awos:verify`. Not bugs — accepted gaps.

### From spec 010 — Frontend reliability

- **AC §2.2 #6** — opt-in persistence across page navigation. Clicking "Find game" then navigating to `/profile` while still searching should keep the user in the queue + navigate back to `/play` when a match is found. **Blocked by:** pre-existing `Play.tsx` unmount cleanup that calls `useMatchmakingStore.leaveQueue()` whenever the user leaves `/play` while in `searching` phase. Needs a product decision + lifecycle refactor. See spec 010 Change Log.

### From spec 011 — Production deployment

- **AC §2.2 #3** — password-reset email flow in prod. Not live-tested. Same `ResendMailer` code path as verify-email (which IS live-verified).
- **AC §2.2 #4** — "resend verification email" UI on delivery failure. Not scripted.
- **AC §2.3 #3** — missing-env-var fail-loud behavior. Not force-tested; code paths exist (`token-verifier.service.ts`, `resend.mailer.ts`).
- **AC §2.4 #2** — game-history-after-restart in prod. Not force-tested; covered by spec 006 e2e.
- **AC §2.4 #3** — mid-matchmaking container restart. Not force-tested in prod; covered by spec 004 e2e + flag-sweep-worker.
- **AC §2.5 #1-3** — two-user matchmaking live in prod (moves within 1s, 10s disconnect/reconnect, browser refresh resume). **Phase B explicitly skipped per user decision** — covered by 76 spec-004 e2e tests + prior live dev verification.
- **AC §2.6 #2** — Prisma migrations auto-applied by Fly `release_command`. **KNOWN ISSUE** — see §🟡 Known Issues below.
- **AC §2.6 #3** — failed health check aborts deploy. Not force-tested; Fly default behavior.

---

## 🟡 Known issues (not deferred, actively worked around)

### Prisma CLI absent from runtime image → `release_command` disabled

**Current state:** `fly.api.toml` has `release_command` commented out with a block comment explaining why. `pnpm deploy --prod` in `apps/api/Dockerfile` strips `prisma` (it's a devDep). Migrations currently run **manually from laptop** against the Neon URL before each prod deploy that includes a new migration.

**Workaround (documented in `docs/DEPLOYMENT.md` Step 4):**
```bash
DATABASE_URL="<neon pooled URL>" pnpm --filter api prisma migrate deploy
```

**Fix path (pick one when ready to tackle):**
- **(a) Install prisma globally in runtime stage** of `apps/api/Dockerfile`:
  ```dockerfile
  RUN npm install -g prisma@5.22.0
  ```
  Adds ~30MB to image. Keeps `prisma` as devDep (clean separation).
- **(b) Move prisma to runtime dependencies** in `apps/api/package.json`. Simpler but blurs dev/prod separation.

After fix: un-comment `release_command` line in `fly.api.toml`.

**Spec needed:** small amend to spec 011, or a tiny `/awos:spec` run for a Fly migrations cleanup. Not urgent — manual migrations are tolerable at MVP scale.

---

## 🟢 Technical debt (not blocking, bites at scale)

### Backend performance (from spec 010-era audit, items 4-6)

- **Nickname search uses `ILIKE '%q%'` with no index.** Starts biting at **10K+ users**. Fix: add trigram index via one Prisma migration:
  ```prisma
  // On User model
  @@index([nicknameNormalized], map: "users_nickname_normalized_trgm_idx", type: Gin)
  ```
  Requires `pg_trgm` extension — Postgres has it out of the box; Prisma needs `previewFeatures = ["postgresqlExtensions"]` (already enabled per our schema).

- **Presence fan-out: `broadcastPresence` queries postgres for all friends of a user on every socket connect/disconnect, then emits one event per friend.** Starts biting at **50+ friends/user** × multiple connects/disconnects per minute. Mitigations:
  - Debounce rapid-fire connect/disconnect transitions (1s hysteresis before emitting).
  - Batch friend-list query via Redis cache (invalidate on friendship accept/decline/unfriend).

- **Challenge expiry sweeper polls Redis every 1s** (`SMEMBERS challenge:active` + `HGETALL challenge:{id}` per active challenge). Starts biting at **1K+ concurrent challenges**. Fix: switch to Redis keyspace notifications (`__keyevent@0__:expired`) instead of cron-polling. Needs a Redis config change (`notify-keyspace-events Ex` in `redis.conf`) + listener re-wiring in `ChallengeExpirySweeper`.

### Code quality (from spec 010-era audit, item 7)

- **Socket.io-client singleton pattern duplicated** between `apps/web/src/features/online/socket.ts` + `apps/web/src/features/friends/friends-socket.ts`. ~60 lines of near-identical code (token-change rebuild, hello emit, disconnect helper). Fix: extract `createNamespaceSocket(namespace: string)` factory. Low priority — zero behavioral issue, pure DRY cleanup.

---

## 🔵 Future enhancements (ideas, not planned)

### Observability pack

Deferred during spec 011 scoping. Shape:
- **Frontend:** Sentry browser SDK OR custom `window.onerror` + unhandled-promise beacon → `POST /api/v1/telemetry/error`.
- **Backend:** `@sentry/node` middleware OR Pino → external aggregator (Grafana Loki, Better Stack).
- **Metrics:** `prom-client` on NestJS → Prometheus endpoint → Grafana dashboard.
- **Uptime:** external pinger (Better Stack / UptimeRobot) on `/api/v1/health`.

Trigger: first time a real user says "it broke" and we have no stack trace.

### CI/CD pipeline

Currently every deploy is manual from laptop (`fly deploy -c ...`). GitHub Actions workflow would:
- On PR merge to main → run `pnpm typecheck` + `pnpm test` → if green, trigger `fly deploy` for both apps.
- Secrets stored in GitHub Actions.

Trigger: more than one developer OR deploys become frequent (>1/week).

### Multi-region deployment

Single `fra` region. US/APAC users see higher latency. Fix needs:
- Neon multi-region (paid plan).
- Upstash Global Database (paid plan).
- Fly machines in `iad`, `syd` (free tier allows multi-region but egress costs apply).

Trigger: live users outside EU, demonstrable latency complaints.

### Cloudflare in front of web

Architecture.md §3 mentions this as `[Assumption]`. Benefits: edge caching, DDoS protection, bot filtering, free TLS termination. Current `yan-chess.com` → Fly directly works fine. Nice-to-have for public launch.

### OAuth (Google / Discord / GitHub)

Spec 001 explicitly deferred. Would reduce signup friction significantly for a public demo. One spec = `/awos:spec OAuth with Google via passport`.

### Avatar upload (S3)

`architecture.md §2` lists S3-compatible storage as `[Assumption]`. Not shipped. Candidates: Cloudflare R2 (cheap, egress-free), AWS S3 (standard), MinIO (self-hosted). Would be its own spec.

### Email templates with branding

Resend is currently sent as plaintext HTML with raw verification link. Branded templates (header logo, footer, consistent typography) would be more professional. Easy spec when branding is settled.

### Automated external backups

Neon has 24h point-in-time restore (free tier) + branch snapshots. Upstash has snapshot backups. **No off-platform mirror.** If both providers simultaneously lost data (unlikely), it's gone. Fix: daily `pg_dump` to S3/B2/R2 via a Fly cron machine.

Trigger: paying users whose data loss would be a legal/reputation issue.

### `www` subdomain for `yan-chess.com`

Currently `yan-chess.com` → Fly works but `www.yan-chess.com` doesn't resolve (not added to DNS). A visitor typing `www.yan-chess.com` gets `DNS_PROBE_FINISHED_NXDOMAIN`. Fix: `fly certs add www.yan-chess.com --app yanchess` + CNAME `www → yan-chess.com` in GoDaddy DNS. 5 minutes.

---

## How to use this backlog

- **When starting a new session:** scan the 🔴 section — these should bite you first if you touch related code.
- **When a `/awos:verify` surfaces a new deferral:** add it under 🟡 with reference to the Change Log entry.
- **When an audit identifies new debt:** add it under 🟢 with a "starts biting at X" marker.
- **When you resolve an item:** delete it (or move to a "Done" section if you want provenance).
- **Priority is implicit by section:** 🔴 first, 🟡 as context, 🟢 before scale, 🔵 when the pain shows up.
