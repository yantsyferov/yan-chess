<!--
This document describes HOW to build the feature at an architectural level.
It is NOT a copy-paste implementation guide.
-->

# Technical Specification: Registration and Login

- **Functional Specification:** `./functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

The feature is implemented in the monorepo (pnpm workspaces) with three packages created by this same vertical: `apps/api` (NestJS), `apps/web` (React + Vite), `packages/shared` (zod schemas and types shared between client and server).

Authentication is a classic **access + refresh**: a short-lived JWT in the `Authorization: Bearer` header, a long-lived opaque refresh token in an `HttpOnly, Secure` cookie whose state is stored in Redis — this gives instant logout and "kill all sessions" on password reset, without waiting for JWT expiry.

Passwords are hashed with **Argon2id**; opaque tokens (verify, reset) are 32 bytes from `crypto.randomBytes`, stored in Postgres with an expiry. Email delivery via **Resend**. Rate-limiting and lockout — via **Redis** (`INCR` + `EXPIRE`). The four starting ratings are created transactionally at the moment of first successful sign-in.

The frontend is a classic SPA with React Router, forms built with `react-hook-form` + the same zod schemas that validate requests on the backend; the access token is kept **in memory only** (protection against XSS stealing from localStorage), with automatic single-flight refresh on 401.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Architecture Changes

The following NestJS modules are created from scratch in `apps/api/src/modules/`:

| Module | Responsibility |
| --- | --- |
| `AuthModule` | Registration, email confirmation, sign in, sign out, refresh, password reset. Content routing and DTO validation. |
| `UsersModule` | Reading own profile (`GET /users/me`), creating starting ratings on first sign-in. |
| `MailModule` | Wrapper over the Resend SDK; two templates — verify and reset. |
| `TokensModule` | Generating opaque tokens, writing/reading/expiring them in Postgres. |
| `RateLimiterModule` | Reusable service `incr(key, windowSec, limit)` on top of Redis — handles lockout and throttle on resend. |
| `PrismaModule` | Singleton Prisma client for all other modules. |

On the frontend the `features/auth/` section (apiClient, authService, session store) and the seven pages listed in §2.4 are added.

### 2.2 Data Model

**Postgres tables (Prisma models, `apps/api/prisma/schema.prisma`):**

| Table | Key columns | Purpose |
| --- | --- | --- |
| `users` | `id` (uuid pk), `email` (citext unique), `nickname_normalized` (text unique — lower(nickname)), `nickname` (text), `password_hash` (text), `email_verified_at` (timestamptz null), `created_at` (timestamptz), `password_updated_at` (timestamptz) | Main identity table. Two uniqueness indexes. `password_updated_at` is used in the JWT as an "epoch" for invalidating access tokens on reset. |
| `email_verification_tokens` | `token_hash` (text pk), `user_id` (fk users.id, cascade), `expires_at` (timestamptz), `used_at` (timestamptz null) | We store the **hash** of the token (SHA-256), not the token itself. That way a leak of the table doesn't give access. |
| `password_reset_tokens` | `token_hash` (text pk), `user_id` (fk), `expires_at`, `used_at` (null) | Same mechanism, 1-hour expiry. |
| `ratings_by_mode` | `(user_id, mode)` composite pk, `rating` (int), `rd` (double precision), `volatility` (double precision), `games_played` (int), `updated_at` | Four rows per user: Bullet/Blitz/Rapid/Classical. Created in one transaction at the moment of first successful sign-in. |

**Redis keys:**

| Key | Type | TTL | Purpose |
| --- | --- | --- | --- |
| `rl:login:fail:<email_lower>` | counter | 15 min | Counter of failed sign-ins; at `≥5` → 429 lockout response until TTL expiry. |
| `rl:resend:verify:<user_id>` | counter | 60 sec | Protection against spamming the email verification resend button. |
| `rl:resend:reset:<email_lower>` | counter | 60 sec | Protection against spamming "forgot password". |
| `session:<refresh_jti>` | hash | 30 days or session | Fields: `userId`, `rememberMe`, `createdAt`, `userAgent`, `ip`. |
| `user:sessions:<user_id>` | set of jtis | — | Index of all active refresh tokens of the user — for "kill all sessions". |

**Migrations:** a single `init-auth` creates all four tables and indexes. Run via `prisma migrate dev` locally and `prisma migrate deploy` on CI.

### 2.3 API Contracts

All paths under `/api/v1`. CORS — only `WEB_URL`. The refresh token cookie is scoped to path `/api/v1/auth`.

| Method | Path | Body / Query | Success | Main errors |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | `{email, nickname, password}` | 201 `{status:"verification_sent"}` | 400 (validation), 409 `{field:"email"|"nickname", code}` |
| POST | `/auth/email/verify` | `{token}` | 200 `{status:"verified"}` | 410 `{code:"token_expired"|"token_used"|"token_invalid"}` |
| POST | `/auth/email/resend` | `{email}` | 200 (always same shape) | 429 `{retryAfterSec}` |
| POST | `/auth/login` | `{email, password, rememberMe}` | 200 `{accessToken, user}` + set-cookie `refresh` | 401 `{code:"invalid_credentials"}`, 403 `{code:"email_not_verified"}`, 429 `{code:"locked", retryAfterSec}` |
| POST | `/auth/logout` | — (reads cookie) | 204 | — |
| POST | `/auth/refresh` | — (reads cookie) | 200 `{accessToken}` + rotated cookie | 401 (missing/invalid) |
| POST | `/auth/password/forgot` | `{email}` | 200 (always same shape) | 429 |
| POST | `/auth/password/reset` | `{token, newPassword}` | 200 `{status:"password_updated"}` | 410 (token_expired/used), 400 (password validation) |
| GET | `/users/me` | — (JWT) | 200 `{id, nickname, email, createdAt, avatar:null, ratings:[{mode,rating,gamesPlayed}×4]}` | 401 |

**Tokens:**
- Access: JWT HS256, payload `{sub:userId, nickname, pwdEpoch}`, TTL 15 min. `pwdEpoch` is checked against `users.password_updated_at` on every validation — a stale JWT after a password change is rejected.
- Refresh: UUIDv4, `jti`, placed in `HttpOnly, Secure, SameSite=Lax` cookie, value is the `jti` itself; state in Redis.

### 2.4 Component Breakdown (frontend)

**Pages and routes (`apps/web/src/pages/`, React Router):**

| Route | Page | Behavior |
| --- | --- | --- |
| `/register` | `RegisterPage` | Registration form, after submit → redirect to `/verify-email/check` |
| `/verify-email/check` | `VerifyEmailCheckPage` | "Check your email…" with a "Send again" button (60-sec cooldown) |
| `/verify-email?token=…` | `VerifyEmailPage` | On mount — POST to verify; shows success or "Link is invalid" |
| `/login` | `LoginPage` | Sign-in form + "Remember me" + "Forgot password?" link |
| `/forgot-password` | `ForgotPasswordPage` | Email form, after submit — same text regardless of outcome |
| `/reset-password?token=…` | `ResetPasswordPage` | "New password" + "confirm" form, success — "Sign in" link |
| `/profile` | `ProfilePage` | Protected route; placeholder avatar, nickname, date, ratings table |
| `/` | `HomePage` | Guest variant ("Sign in" button in header) or authenticated (nickname + "Find game") |

**Shared components (`apps/web/src/components/`):** `TextField`, `PasswordField`, `FormError`, `AvatarPlaceholder`, `RatingTable`, `AuthLayout` (container for /register, /login, etc.).

**Auth state (`apps/web/src/features/auth/`):**
- `useAuthStore` (Zustand) — `accessToken` (in memory only), `user`, `hydrate()`, `clear()`.
- `apiClient` — fetch wrapper; on 401 runs a single-flight refresh (`POST /auth/refresh`), retries the original request, on failure — `clear()` + redirect to `/login`.
- `authService` — thin layer of functions mapping onto endpoints.
- `ProtectedRoute` — HOC/wrapper that redirects guests to `/login`.

**Form validation:** `react-hook-form` + zod. Schemas are imported from `@yanchess/shared/schemas/auth` — one source of truth for client and server.

### 2.5 Logic / Algorithms

- **Password hash (Argon2id, OWASP 2023 Minimum):** `memoryCost=19456 KiB`, `timeCost=2`, `parallelism=1`. The `argon2` package. Parameters are stored in code (not in env) — changing them requires a password migration.
- **Opaque token generation:** `crypto.randomBytes(32).toString("base64url")`; the DB stores SHA-256 of the token, the token itself only goes into the email.
- **Sign-in lockout:** on each failure `INCR rl:login:fail:<email_lower>`; on the first increment — `EXPIRE 900`. Before verifying the password we read the counter; at `≥5` — immediately 429 with `retryAfterSec = TTL(key)`. A successful sign-in **does not reset** the counter (otherwise the response time for the correct password on a locked account would differ); it expires by TTL.
- **Timing-safe sign-in:** if `email` is not found, we perform a "dummy" hash of a constant string with the same Argon2id parameters and return the same 401 `invalid_credentials` — so that response duration doesn't reveal account existence.
- **Resend throttle:** `INCR rl:resend:verify:<user_id>` + `EXPIRE 60`; at `>1` — 429 with `retryAfterSec`.
- **Session revocation on password reset:** in a single Lua transaction: `SMEMBERS user:sessions:<id>` → for each `DEL session:<jti>` → `DEL user:sessions:<id>`. In parallel `users.password_updated_at` is updated in Postgres — this invalidates all existing access JWTs through the `pwdEpoch` check.
- **Rating creation on first sign-in:** in the login service, after successful password and verified email checks, in a single Prisma transaction `createMany({ data: [Bullet,Blitz,Rapid,Classical] × 1500/350/0.06/0, skipDuplicates: true })`. Idempotent by composite PK.
- **Nickname normalization:** `nickname_normalized = nickname.toLowerCase()` — for case-insensitive uniqueness; the original case is displayed.

### 2.6 Email Templates (Resend)

`apps/api/src/modules/mail/templates/`:

| Template | Subject | Main button → URL |
| --- | --- | --- |
| `verify-email` | "Confirm your YanChess registration" | `${WEB_URL}/verify-email?token=${token}` |
| `reset-password` | "YanChess password reset" | `${WEB_URL}/reset-password?token=${token}` |

We can start with plain HTML strings; if needed, migrate to `react-email` without changing the MailModule API.

### 2.7 Configuration (env)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | HS256 secret for access tokens (offline rotation: change `pwdEpoch` or force logout of all) |
| `JWT_ACCESS_TTL_SEC` | 900 |
| `REFRESH_TTL_SEC_REMEMBER` | 2592000 (30 days) |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend SDK + from-address |
| `WEB_URL`, `API_URL` | public URLs (building links, CORS) |
| `COOKIE_DOMAIN`, `COOKIE_SECURE` | refresh cookie settings per environment |
| `ARGON2_SECRET_PEPPER` (optional) | "pepper" added before hashing — protects the DB against leaks |

### 2.8 File Layout

```
apps/
  api/
    prisma/{schema.prisma,migrations/}
    src/
      modules/
        auth/{auth.module,auth.controller,auth.service}.ts
        auth/strategies/jwt.strategy.ts
        auth/guards/{jwt-auth,refresh}.guard.ts
        auth/dto/*.ts
        users/{users.module,users.controller,users.service}.ts
        mail/{mail.module,mail.service}.ts
        mail/templates/{verify-email,reset-password}.ts
        tokens/token.service.ts
        rate-limiter/rate-limiter.service.ts
        prisma/prisma.service.ts
      main.ts
    test/{e2e, integration}
  web/
    src/
      pages/{Register,VerifyEmail,VerifyEmailCheck,Login,ForgotPassword,ResetPassword,Profile,Home}.tsx
      components/{TextField,PasswordField,FormError,AvatarPlaceholder,RatingTable,AuthLayout}.tsx
      features/auth/{apiClient.ts,authService.ts,useAuthStore.ts,ProtectedRoute.tsx}
      routes.tsx
      main.tsx
packages/
  shared/
    src/schemas/auth.ts        # zod: register, login, forgot, reset
    src/types/user.ts          # UserDto, RatingDto, Mode
```

---

## 3. Impact and Risk Analysis

### System Dependencies

- **Postgres + Redis** must be running in dev-compose and on Fly.io — this is the first feature that uses them and effectively introduces them to the project.
- **Resend account + domain verification** are needed by the time of the prod deploy (doesn't block dev — there we log emails to stdout and pull the link from the logs).
- **CDN/Cookie domain:** if web and api live on different subdomains, a correct `COOKIE_DOMAIN` and CORS with `credentials: include` are required.

### Potential Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| **Email enumeration** (attacker learns which emails are registered) | Same response shape and timing-safe password check on `/login`, `/password/forgot`, `/email/resend`. Dummy hash verification for non-existing emails. |
| **Sign-in brute force** | Per-email lockout 15 min after 5 failures; additionally — a global IP rate limit (separate Redis key) can be added in the next feature without changing contracts. |
| **XSS → access token theft** | Access token in memory only (Zustand without persist). Refresh — HttpOnly cookie. CSP is returned by the API, the frontend adds it too. |
| **Replay of confirmation / reset token** | `used_at` is marked on first use; a repeat click — 410 `token_used`. |
| **Token table leak** | Only SHA-256 of the token is stored; the token itself is only visible in the email. |
| **Nickname squatting** | Uniqueness by `nickname_normalized` (lower); the blocklist of reserved names can be extended. A migration will add the index. |
| **Resend failure** | For MVP — soft fail: the user gets a regular response, logs show `ERROR mail.send.failed`; an alert in Sentry. Retries through a queue — a separate task later. |
| **Clock skew between JWT signing and validation** | `clockTolerance: 5s` in `jsonwebtoken.verify`. |
| **CSRF on refresh** | `SameSite=Lax` + `credentials: include` only from our `WEB_URL`; the `/auth/refresh` endpoint doesn't accept a body, so a CSRF form against it is useless. |
| **Password pepper loss** | If we decide to use `ARGON2_SECRET_PEPPER`, losing it = all passwords invalid → store it as a DB-dump-level secret with a clear runbook. The decision to use it — Assumption below. |

**Assumption (to be confirmed):** for MVP we go **without** `ARGON2_SECRET_PEPPER` — simplicity of storage and backups outweighs the additional layer. If we want to add it later, it's not a breaking change: it's introduced with a "rehash on next login" migration.

---

## 4. Testing Strategy

Three layers. All tests related to this feature are annotated `@spec: 001-registration-and-login` and — for end-to-end tests — `@regression`.

**Unit (Vitest):**
- `TokenService`: generation → hashing → verification.
- `PasswordHasher` (Argon2id wrapper): hash + verify, OWASP parameters.
- `RateLimiterService`: incr-with-expire-on-first-increment, correct `retryAfterSec` at the window boundary.
- zod schemas `auth.ts` (register/login/reset) — happy and each validation branch.
- `pwdEpoch` mismatch must reject old JWTs.

**Integration (Vitest + supertest against a NestJS test instance; Testcontainers spin up Postgres and Redis):**
- Each endpoint — happy path + all error branches from §2.3.
- `register` → `verify` → `login` → `/users/me` returns 4 ratings at 1500/0.
- Lockout: 5 failed sign-ins → sixth attempt 429 even with the correct password → after 15 min it works again.
- Timing-safe: comparing `/login` response times for a non-existing email vs. a known-with-wrong-password one — fits within a single confidence interval (`±20%`).
- Reset: issue → verify → confirm that all `session:*` of this user are deleted and `password_updated_at` is updated; the old access JWT is rejected on the next `/users/me`.

**E2E (Playwright):** three golden flows through the UI:
1. Register → pick up the verify link from `apps/api/dev-outbox` → verify → login → see the profile with four rows at 1500.
2. Login → logout → attempt to open `/profile` → redirect to `/login`.
3. Forgot → pick up the reset link → enter a new password → login with the new password succeeds; the old password gives 401.

For E2E the dev stack is brought up via `docker compose up` (postgres+redis), Resend is replaced with a local outbox (writes JSON files). A separate script `pnpm test:e2e` clears the outbox before each run.

**RED validation:** each new test is first run against code **without** implementation (or with the logic temporarily disabled), the failure is recorded, then the implementation is enabled — the test becomes green. This is a `/awos:implement` requirement.
