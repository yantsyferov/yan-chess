# Tasks: Registration and Login (`001-registration-and-login`)

Vertical slices of the auth feature. After each slice the whole app must be startable (`docker compose up`, `pnpm --filter api dev`, `pnpm --filter web dev`) and the slice's new user-visible value verifiable end-to-end.

Agents referenced in `**[Agent: ...]**` live in `.claude/agents/`. QA agent for the final regression slice: `testing-expert`.

---

- [x] **Slice 1: Monorepo walking skeleton with /register and /login forms (client-side only)**

  > Guest opens http://localhost:5173/register and http://localhost:5173/login, sees forms with the fields from the spec, and gets client-side validation messages (no network calls yet). The API answers `GET /api/v1/health` with 200.

  - [x] Task: Initialize pnpm workspace monorepo with three packages: `apps/api`, `apps/web`, `packages/shared`. Add root `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`. Add `.gitignore`. **[Agent: cloud-infra]**
  - [x] Task: Scaffold `apps/api` as a NestJS app (`@nestjs/cli` style) with a single `HealthController` serving `GET /api/v1/health` → `{status:"ok"}`. Add dev script `pnpm --filter api dev`. **[Agent: nestjs-backend]**
  - [x] Task: Scaffold `apps/web` as React + TypeScript + Vite with React Router. Create seven empty page components (`Home`, `Register`, `VerifyEmailCheck`, `VerifyEmail`, `Login`, `ForgotPassword`, `ResetPassword`, `Profile`) and routes to them. Add dev script `pnpm --filter web dev`. **[Agent: react-frontend]**
  - [x] Task: In `packages/shared`, add zod schemas for `register`, `login`, `forgotPassword`, `resetPassword` (field rules per `functional-spec.md` §2.1 & §2.5). Export from `@yanchess/shared`. **[Agent: nestjs-backend]**
  - [x] Task: Implement `RegisterPage` and `LoginPage` with `react-hook-form` + the shared zod schemas (`zodResolver`). Render exact error texts from the functional spec (per-field). No submit action yet — just show validation. Reuse `TextField`, `PasswordField`, `FormError` primitives created here. **[Agent: react-frontend]**
  - [x] Verify: Start `apps/api` (background, record PID) and `apps/web` (background, record PID). `curl http://localhost:3000/api/v1/health` returns 200. Open `/register` via Playwright DOM, submit with empty fields → assert visible texts "Enter a valid email", "Nickname can contain 3–20 Latin letters, digits, and underscores", "Password must be at least 8 characters and contain at least one letter and one digit". Repeat for `/login` with empty submit → assert visible texts. Stop both servers by their PIDs. Delete any screenshots/recordings produced during the check. **[Agent: react-frontend]**

---

- [x] **Slice 2: Guest can register — row lands in Postgres, response is "verification_sent" (email not sent yet, logged to stdout)**

  > Guest fills the register form with valid data, submits, lands on `/verify-email/check`; a `users` row appears with hashed password; duplicate email/nickname return the correct inline error.

  - [x] Task: Add `docker-compose.yml` at repo root with `postgres:16` and `redis:7` services, named volumes, healthchecks, and local ports (`5432`, `6379`). Document `pnpm db:up` / `db:down` in root `package.json`. **[Agent: cloud-infra]**
  - [x] Task: Add Prisma to `apps/api`. Create `schema.prisma` with the `User` model (fields per `technical-considerations.md` §2.2, including `nickname_normalized` unique index and `citext` for email). Create `init-auth` migration. Add `prisma generate` to postinstall. **[Agent: postgres-redis-data]**
  - [x] Task: Create `apps/api/src/modules/auth` with `AuthModule`, `AuthController`, `AuthService`. Implement `POST /api/v1/auth/register` using the shared zod schema for DTO validation (via a `ZodValidationPipe`). On success: hash password with argon2id (OWASP 2023 Minimum params), insert user, return `201 {status:"verification_sent"}`. On duplicate email → `409 {field:"email", code:"email_taken"}`. On duplicate nickname → `409 {field:"nickname", code:"nickname_taken"}`. **[Agent: nestjs-backend]**
  - [x] Task: Wire `RegisterPage` submit to `POST /api/v1/auth/register` via a small `authService`. On 201 → navigate to `/verify-email/check` with the submitted email in route state; render "Check your email…" there. On 409 → set the field-specific error in the form from the response. **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, run `prisma migrate deploy`, start api + web (background, record PIDs). Via Playwright DOM: register a fresh user with unique email+nickname → assert URL ends with `/verify-email/check` and the inbox-message contains the email. Register the same email again → assert visible "This email is already registered". Register a new email with the same nickname → assert visible "This nickname is already taken". Query `psql $DATABASE_URL -c "select email, nickname, length(password_hash) from users"` → confirm one row per unique registration, `password_hash` length matches argon2id. Stop api + web by PID. `pnpm db:down`. Delete any Playwright screenshots. **[Agent: react-frontend]**

---

- [x] **Slice 3: Email verification works end-to-end via dev outbox**

  > After registration, a verification "email" lands in a local dev outbox folder as JSON; opening the link marks `email_verified_at`; expired/used tokens show "Link is invalid" with a resend button; unverified login attempt shows "Please verify your email".

  - [x] Task: Extend Prisma schema with `EmailVerificationToken` model (per §2.2 — stores `token_hash` SHA-256, not raw). Add migration. **[Agent: postgres-redis-data]**
  - [x] Task: Create `apps/api/src/modules/mail` with a `MailService` interface and a `DevOutboxMailer` implementation that writes each email as a JSON file to `apps/api/dev-outbox/<timestamp>-<id>.json` (fields: `to`, `subject`, `html`, `token`). Register it conditionally when `MAIL_DRIVER=outbox`. **[Agent: nestjs-backend]**
  - [x] Task: Create `apps/api/src/modules/tokens/token.service.ts` with `issue(userId, kind, ttlSec)` returning raw token + storing hashed row, and `consume(kind, token)` validating + marking `used_at`. **[Agent: nestjs-backend]**
  - [x] Task: In `AuthService.register`, after inserting the user, issue a `verify` token (TTL 24h) and send via `MailService` with link `${WEB_URL}/verify-email?token=<raw>`. Implement `POST /api/v1/auth/email/verify {token}` → consume token → set `users.email_verified_at` → `200 {status:"verified"}` or `410 {code:"token_expired"|"token_used"|"token_invalid"}`. **[Agent: nestjs-backend]**
  - [x] Task: Implement `VerifyEmailPage` — on mount reads `?token=` and calls the endpoint; renders "Email verified. [Sign in]" on success and "Link is invalid" with "Send new link" button (wired later) on 410. **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, start api+web (background, PIDs). Register a new user via Playwright DOM. Read the latest JSON file in `apps/api/dev-outbox/` to extract the verify link. Open the link in the same browser context → assert "Email verified" visible, assert `users.email_verified_at` is non-null via `psql`. Edit the DB to set `expires_at` back a day (`update email_verification_tokens set expires_at = now() - interval '1 day'`), re-open the same link → assert "Link is invalid". Stop daemons by PID, clean dev-outbox and Playwright artifacts. **[Agent: react-frontend]**

---

- [x] **Slice 4: Login + session cookie + /users/me — verified user sees authenticated shell**

  > Verified user logs in; access-JWT in response, refresh cookie set; `/profile` works for authenticated and redirects guests to `/login`; `/users/me` returns `{id, nickname, email, createdAt, avatar:null, ratings:[]}` (empty ratings for now); logout clears session.

  - [x] Task: Add Redis client to `apps/api` (`ioredis`). Create `apps/api/src/modules/redis/redis.service.ts` as the thin wrapper (SET/GET/DEL/SMEMBERS/SADD/EXPIRE/INCR/PIPELINE). Wire into `AuthModule`. **[Agent: postgres-redis-data]**
  - [x] Task: Implement `POST /api/v1/auth/login {email, password, rememberMe}` — verify password (dummy-hash for unknown email to equalize timing), reject when `email_verified_at` is null with `403 {code:"email_not_verified"}`. On success: issue access JWT (15 min, HS256, payload `{sub, nickname, pwdEpoch=password_updated_at.toISOString()}`), issue refresh `jti` (uuidv4), persist `session:<jti>` hash and add to `user:sessions:<id>` set in Redis with TTL per `rememberMe`, set `refresh` HttpOnly cookie. Response: `200 {accessToken, user:{id,nickname,email,createdAt}}`. **[Agent: nestjs-backend]**
  - [x] Task: Implement `JwtAuthGuard` and `POST /auth/refresh` (reads refresh cookie, rotates `jti`, re-signs access, extends session TTL) and `POST /auth/logout` (reads refresh cookie, deletes `session:<jti>` key, removes from set, clears cookie). Implement `GET /api/v1/users/me` under `UsersModule` protected by the guard, returning `{id, nickname, email, createdAt, avatar:null, ratings:[]}`. **[Agent: nestjs-backend]**
  - [x] Task: On the web side, implement `features/auth/useAuthStore` (Zustand; `accessToken` in memory only, `user`), `features/auth/apiClient` (fetch wrapper that attaches `Authorization: Bearer`, on 401 performs single-flight `POST /auth/refresh`, on repeated 401 clears store and redirects to `/login`), `features/auth/authService` (login/logout). Add `ProtectedRoute` and wrap `/profile`. On successful login navigate to `/`. **[Agent: react-frontend]**
  - [x] Task: Build `ProfilePage` (first iteration): shows `AvatarPlaceholder` (coloured circle with first letter of nickname), nickname, `createdAt`. Fetches `/users/me` via `apiClient`. **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, start api+web (PIDs). Register + verify a user through the UI (reuse Slice 3 steps). Log in with correct email/password → assert header shows nickname and URL is `/`. Open `/profile` → assert placeholder avatar + nickname + today's date visible. Log out via the profile menu → assert URL is `/`, header shows "Sign in". Open `/profile` directly as guest → assert redirect to `/login`. `curl -b <refresh-cookie-jar> http://localhost:3000/api/v1/users/me` after logout returns 401. Stop daemons by PID, delete artifacts. **[Agent: react-frontend]**

---

- [x] **Slice 5: Starting ratings seeded on first login — profile shows four 1500/0 rows**

  > A brand-new verified user, on their first successful login, has four `ratings_by_mode` rows created in one transaction. `/users/me.ratings` returns Bullet/Blitz/Rapid/Classical each at 1500 and 0 games. `ProfilePage` renders the `RatingTable`.

  - [x] Task: Extend Prisma schema with `RatingByMode` model (composite PK `(userId, mode)`, fields `rating`, `rd`, `volatility`, `gamesPlayed`, `updatedAt`). Add `Mode` enum (`Bullet|Blitz|Rapid|Classical`). Add migration. **[Agent: postgres-redis-data]**
  - [x] Task: In `AuthService.login` happy-path, after password+verification checks, call `UsersService.ensureStartingRatings(userId)` in the same Prisma transaction. The method uses `createMany({ data: 4 rows at 1500/350/0.06/0, skipDuplicates:true })`. **[Agent: nestjs-backend]**
  - [x] Task: Update `GET /users/me` to join `ratings_by_mode` and return `ratings:[{mode, rating, gamesPlayed}, …]` in a stable order (Bullet, Blitz, Rapid, Classical). **[Agent: nestjs-backend]**
  - [x] Task: Build `RatingTable` component in `apps/web/src/components/` and render it on `ProfilePage`. Four rows, English labels, "N (M games)" format. **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, start api+web (PIDs). Register + verify + log in a fresh user via UI. Open `/profile` and assert four visible rows: "Bullet: 1500 (0 games)", "Blitz: 1500 (0 games)", "Rapid: 1500 (0 games)", "Classical: 1500 (0 games)". `psql` → confirm 4 rows exist for this user in `ratings_by_mode` with `rating=1500, games_played=0`. Log out and log back in → assert still 4 rows (idempotency; no duplicates). Stop daemons, delete artifacts. **[Agent: react-frontend]**

---

- [x] **Slice 6: Email-verification UX — resend throttle (1/min) and login-blocked-on-unverified**

  > User who registered but has not yet clicked the verify link sees the correct error on login; can click "Send new link" and get a fresh outbox entry; second click within 60s shows the throttle message.

  - [x] Task: Implement `RateLimiterService` in `apps/api/src/modules/rate-limiter/` with method `check(key, windowSec, limit)` → returns `{allowed, retryAfterSec}` using `INCR` + `EXPIRE` on first increment. Unit-test with ioredis-mock. **[Agent: postgres-redis-data]**
  - [x] Task: Implement `POST /api/v1/auth/email/resend {email}` — same-shape response for existing/non-existing email; when found, apply `RateLimiterService.check("rl:resend:verify:"+userId, 60, 1)`; when allowed, re-issue a verify token and send via `MailService`. **[Agent: nestjs-backend]**
  - [x] Task: Already in Slice 4 login returns 403 `email_not_verified` for unverified users — add UI handling: `LoginPage` renders a dedicated error block "Please verify your email. Check `<email>` or [resend the email]"; button fires `POST /auth/email/resend`. **[Agent: react-frontend]**
  - [x] Task: Wire the "Send new link" button on `VerifyEmailPage` (expired/used state) to the same `POST /auth/email/resend` call. **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, start api+web (PIDs). Register a user but do not click the link. Try to log in → assert visible "Please verify your email". Click "Resend email" → assert a new JSON appears in `apps/api/dev-outbox/`. Click again within 60s → assert visible "Email already sent. Try again in `N` seconds". Stop daemons, clean dev-outbox and artifacts. **[Agent: react-frontend]**

---

- [x] **Slice 7: Login lockout — 5 failed attempts → 15-min 429**

  > After 5 wrong passwords for the same email, the 6th attempt returns 429 regardless of password correctness; identical response text; unknown emails still return the generic `invalid_credentials` without leaking that the account doesn't exist.

  - [x] Task: In `AuthService.login`, before password check: `const gate = await rl.check("rl:login:fail:"+email.toLowerCase(), 900, 5)` — if `!allowed` → throw 429 `{code:"locked", retryAfterSec:gate.retryAfterSec}` with constant-time delay (same dummy-hash path as unknown email). On failed password → increment the counter. **[Agent: nestjs-backend]**
  - [x] Task: Update `LoginPage` to render a dedicated error block for 429 lockout: "Too many failed attempts. Try again in 15 minutes". **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, start api+web (PIDs). Register + verify a user. Via UI, submit 5 wrong-password attempts → assert "Invalid email or password" each time. 6th attempt (even with the CORRECT password) → assert "Too many failed attempts. Try again in 15 minutes". `redis-cli get rl:login:fail:<email>` → counter ≥ 5. Separately via `curl`: submit login with a never-registered email → assert same `{code:"invalid_credentials"}` shape (not any hint about absence). Stop daemons, delete artifacts. **[Agent: react-frontend]**

---

- [x] **Slice 8: Password reset — forgot → email → reset page → kills all sessions**

  > User triggers "Forgot password?", gets a reset "email" in the outbox, follows the link, sets a new password; all existing sessions (verified via a second browser context) are kicked to `/login`; the old access-JWT is also rejected by `/users/me`.

  - [x] Task: Extend Prisma schema with `PasswordResetToken` model (per §2.2). Add migration. **[Agent: postgres-redis-data]**
  - [x] Task: Implement `POST /api/v1/auth/password/forgot {email}` — same-shape response for existing/missing; when found, throttle via `rl:resend:reset:<email>` (window 60s, limit 1), issue a `reset` token (TTL 1h), send via `MailService` with link `${WEB_URL}/reset-password?token=<raw>`. **[Agent: nestjs-backend]**
  - [x] Task: Implement `POST /api/v1/auth/password/reset {token, newPassword}` — validate new password with shared zod schema, consume token (mark `used_at`), rehash + update password, bump `users.password_updated_at`, then revoke all sessions: `SMEMBERS user:sessions:<id>` → pipeline-DEL each `session:<jti>` → DEL set. Return `200 {status:"password_updated"}` or `410` on bad token. **[Agent: nestjs-backend]**
  - [x] Task: In `JwtAuthGuard`, after signature verification, load `users.password_updated_at` and compare to the JWT's `pwdEpoch` — mismatch → 401. **[Agent: nestjs-backend]**
  - [x] Task: Build `ForgotPasswordPage` (one-field form; always identical success text per spec) and `ResetPasswordPage` (two-field form, uses shared zod schema). Success → "Password updated. [Sign in]". Expired token → "Link is invalid". **[Agent: react-frontend]**
  - [x] Verify: `pnpm db:up`, start api+web (PIDs). Register + verify + log in a user in Playwright context A. Open context B (persistent-context #2), log in with the same account → both should see `/profile` succeed. Trigger "Forgot password?" in context A, extract reset link from dev-outbox, open it in context A, set a new password → assert "Password updated". Reload `/profile` in context B → assert redirect to `/login` (session revoked). Log in in context B with the OLD password → assert "Invalid email or password". Log in in context B with the NEW password → assert success. Via `curl` with the OLD access-JWT from context A: `GET /users/me` → assert 401 (pwdEpoch mismatch). Stop daemons, clean dev-outbox + artifacts. **[Agent: react-frontend]**

---

- [x] **Slice 9: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 001-registration-and-login` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
