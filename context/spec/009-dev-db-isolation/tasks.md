# Tasks: Dev DB isolation + dev-user seed

Spec: `context/spec/009-dev-db-isolation/`

Vertical slices — each one leaves the project runnable with a measurable DX improvement. Specs 001-008 must stay functional after every slice (74 e2e + 73 unit + 252 web tests green at every checkpoint).

---

- [x] **Slice 1: Isolated test database — `test:e2e` cannot touch dev-API data**

  Minimum visible value: a developer has alice registered in dev `yanchess` and an active online game. They run `pnpm --filter api test:e2e`. All 74 tests pass. Alice is still signed in, her friends list is intact, the active game still playable. Dev state is byte-identical before and after the e2e run.

  - [x] Create `scripts/postgres-init.sql` at repo root with `CREATE DATABASE yanchess_test;`. Update `docker-compose.yml` → `postgres.volumes:` to mount it at `/docker-entrypoint-initdb.d/01-init-test-db.sql:ro`. This handles fresh container boots. **[Agent: postgres-redis-data]**
  - [x] Add three scripts to `apps/api/package.json`:
    - `"db:create:test"` — idempotent `CREATE DATABASE yanchess_test` via `psql` with a `pg_database` existence check. Exact command per technical-considerations §2.1.
    - `"db:migrate:test"` — `DATABASE_URL=postgresql://yanchess:yanchess@localhost:5432/yanchess_test prisma migrate deploy`.
    - `"db:setup:test"` — `pnpm db:create:test && pnpm db:migrate:test`. **[Agent: postgres-redis-data]**
  - [x] Create `apps/api/test/e2e/env-setup.ts` with the DATABASE_URL + REDIS_URL overrides per technical-considerations §2.3:
    - `process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? "postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public"`
    - `process.env.REDIS_URL = process.env.REDIS_URL_TEST ?? "redis://localhost:6379/1"` (if the project uses `REDIS_URL`; otherwise set whatever env var `apps/api/src/modules/redis/` reads — grep first).
    No other content. **[Agent: nestjs-backend]**
  - [x] Patch `apps/api/vitest.config.ts` (the e2e Vitest config) to add `test.setupFiles: ["./test/e2e/env-setup.ts"]`. If a setupFiles array already exists, append to it. Do NOT touch `vitest.unit.config.ts` — unit tests don't need DB. **[Agent: nestjs-backend]**
  - [x] Run `pnpm --filter api db:setup:test` once from the running developer's shell to create `yanchess_test` + apply migrations to it. (The init SQL script only fires on empty volumes, so existing containers need this manual step once.) **[Agent: nestjs-backend]** (ran during Task A/B verify — 6 migrations applied, idempotent re-run clean)
  - [x] Verify: Confirm the isolation works end-to-end.
    1. Register a canary user in dev `yanchess` via curl: `curl POST /api/v1/auth/register { email: "canary-$(date +%s)@test.local", password: "Password123!", nickname: "canary$(date +%s)" }` as the dev-API running on port 3000. Record the user id returned (via `docker exec yanchess-postgres-1 psql -U yanchess -d yanchess -t -c "SELECT id FROM users WHERE email LIKE 'canary-%'"`).
    2. Run `pnpm --filter api test:e2e`. All 74 tests must pass.
    3. After e2e completes (which killed port 3000), restart the dev-API from `apps/api/dist/main.js` (record PID — leave it running).
    4. Query dev DB again: `docker exec yanchess-postgres-1 psql -U yanchess -d yanchess -t -c "SELECT COUNT(*) FROM users WHERE email LIKE 'canary-%'"` → must return 1. The canary row survived.
    5. Query test DB: `docker exec yanchess-postgres-1 psql -U yanchess -d yanchess_test -t -c "SELECT COUNT(*) FROM users"` → must return 0 (e2e truncated it, which is correct).
    6. Confirm `redis-cli -n 0 KEYS '*' | wc -l` is non-zero AND `redis-cli -n 1 KEYS '*' | wc -l` is 0 (dev state in DB 0 untouched, test state in DB 1 wiped by e2e).
    7. Clean up the canary user via psql `DELETE FROM users WHERE email LIKE 'canary-%'`. Delete any screenshots/logs started during verify. Final: dev-API running on port 3000, dev state preserved. **[Agent: general-purpose]**

- [x] **Slice 2: Dev-user seed + documentation**

  Minimum visible value: a developer with an empty dev `yanchess` database (or a corrupted one after a bad e2e run from the pre-spec-009 era) runs `pnpm --filter api seed:dev` and immediately after can sign in at `http://localhost:5173` as alice with `Password123!`, see bob in their Friends tab. Re-running the seed is harmless.

  - [x] Add `tsx` as a devDependency in `apps/api/package.json`: `pnpm --filter api add -D tsx`. Verify the install succeeds. **[Agent: nestjs-backend]**
  - [x] Create `apps/api/scripts/seed-dev.ts` per technical-considerations §2.4:
    - Instantiates `new PrismaClient()`.
    - Safety-net: refuses to run if `DATABASE_URL` contains the substring `_test` unless `process.argv.includes('--allow-test-db')`. Prints clear error and exits 1 in that case.
    - Upserts alice (`alice@test.local`, nickname `alice`), bob (`bob@test.local`, nickname `bob`), charlie (`charlie@test.local`, nickname `charlie`) — each with `passwordHash` set to a fresh argon2 hash of `Password123!` AND `emailVerifiedAt = new Date()` on BOTH create AND update paths. Nickname's normalized form must also be set (check Prisma schema for the exact column name — likely `nicknameNormalized`).
    - Upserts `ratingByMode` for each user with `mode: Blitz, rating: 1500, gamesPlayed: 0` — but ONLY on create path; update path is empty so real-game ratings are preserved.
    - Computes canonical `(userAId, userBId)` pair for alice ↔ bob (lexicographic UUID compare).
    - Upserts friendship with `status: 'accepted'`, `initiatedBy: alice.id`, `respondedAt: new Date()`. Update path forces accepted state (in case of leftover pending from a prior test run).
    - Prints a short summary: nicknames, friendship status, elapsed ms.
    - Catches errors: prints `[seed-dev] <error context>` + exits 1 on Prisma connection failure or migration-out-of-date error. Clean exit 0 on success.
    Use argon2 from `apps/api/node_modules/argon2` (same lib as the auth stack). Grep `apps/api/src/modules/auth/` to confirm the exact import + hash parameters used — match them so hashed passwords are compatible with the auth login code. **[Agent: nestjs-backend]**
  - [x] Add `"seed:dev": "tsx scripts/seed-dev.ts"` to `apps/api/package.json` scripts. **[Agent: nestjs-backend]**
  - [x] Add new section `## 9. Dev Workflow` to `context/product/architecture.md`, after `## 8. Backend Module Patterns`, before any `### Closed Decisions` subsection. Mark `_[Confirmed]_` with reference to spec 009. Content per technical-considerations §2.5:
    - Two databases note: `yanchess` (dev) + `yanchess_test` (e2e scratch), both in the same Postgres container.
    - Env vars: `DATABASE_URL` (required, dev-API) + `DATABASE_URL_TEST` (optional override for e2e) + `REDIS_URL_TEST` (optional override for e2e Redis DB).
    - Day-one setup: `docker-compose up -d` → `pnpm install` → `pnpm --filter api prisma:migrate:deploy` → `pnpm --filter api db:setup:test` → `pnpm --filter api seed:dev` → `pnpm dev`.
    - Everyday workflow: `pnpm --filter api test:e2e` is now safe to run anytime — does not touch dev state.
    - After a Prisma migration: also run `pnpm --filter api db:migrate:test` to keep test schema in sync.
    - "Reset dev state" recipe: run `pnpm --filter api seed:dev` to re-establish alice/bob/charlie + the friendship. **[Agent: nestjs-backend]**
  - [x] Verify: Confirm the seed produces the required state and is idempotent.
    1. Wipe dev `yanchess` users first: `docker exec yanchess-postgres-1 psql -U yanchess -d yanchess -c "TRUNCATE users CASCADE"`.
    2. Run `pnpm --filter api seed:dev`. Confirm exit code 0 AND elapsed time < 5 seconds (quote the seed script's own summary line).
    3. Query dev DB: `docker exec yanchess-postgres-1 psql -U yanchess -d yanchess -t -c "SELECT nickname, email_verified_at IS NOT NULL FROM users WHERE email LIKE '%@test.local' ORDER BY nickname"` → must show exactly alice, bob, charlie, all verified.
    4. Query friendships: `docker exec yanchess-postgres-1 psql -U yanchess -d yanchess -t -c "SELECT u1.nickname, u2.nickname, status FROM friendships f JOIN users u1 ON u1.id=f.user_a_id JOIN users u2 ON u2.id=f.user_b_id"` → must show one accepted alice ↔ bob row.
    5. Idempotency: re-run `pnpm --filter api seed:dev`. Exit 0 again. Repeat queries from (3)+(4): row counts unchanged.
    6. UI smoke via Playwright MCP (dev-API already running on port 3000; Vite starts BACKGROUND via `cd apps/web && pnpm dev > /tmp/vite.log 2>&1 &` with recorded PID). Sign in as alice with `Password123!`, navigate `/friends`, confirm bob visible with presence dot. Snapshot the DOM showing the row.
    7. Safety-net: run `DATABASE_URL="postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public" pnpm --filter api seed:dev` → must exit 1 with the clear error "DATABASE_URL points at a test DB; pass --allow-test-db if you really mean it".
    8. Cleanup: kill Vite PID (not dev-API), delete `/tmp/vite.log` + any screenshots, close Playwright browser. **[Agent: general-purpose]**

- [x] **Slice 3: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read `context/spec/009-dev-db-isolation/functional-spec.md` acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers: unit for pure logic (mock Prisma, confirm seed-dev's `upsert` call counts for new vs returning run), integration for the setup-files hook (small test asserting `env-setup.ts` sets DATABASE_URL to the yanchess_test URL when DATABASE_URL_TEST is unset), e2e for the isolation invariant (shell-level canary test similar to Slice 1 Verify but automated). Write tests with RED validation: temporarily remove the `env-setup.ts` from `setupFiles` in vitest config, run the canary e2e invariant, show it fails (dev data is modified); restore, show it passes. Annotate each test with `@spec: 009-dev-db-isolation` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. Also run `pnpm --filter web typecheck`, `pnpm --filter web test -- --run`, `pnpm --filter api typecheck`, `pnpm --filter api test:unit`, `pnpm --filter api test:e2e` to confirm zero regressions in specs 001-008 behavior (74 e2e, 73 unit, 252 web minimum). **[Agent: testing-expert]**
