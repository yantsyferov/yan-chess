# Technical Specification: Dev DB isolation + dev-user seed

- **Functional Specification:** `context/spec/009-dev-db-isolation/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

Two small, independent pieces of plumbing — both backend-only, no code changes to app services.

**DB isolation:** add a second logical database `yanchess_test` to the existing Postgres container. The dev-API continues to use `yanchess`; the e2e suite overrides `DATABASE_URL` to point at `yanchess_test` via a Vitest `setupFiles` hook that executes before any Prisma client instantiates. The two databases share the same Postgres instance, which is simpler than a second container and fits our MVP scale.

**Dev seed:** a new `tsx`-executed TypeScript script at `apps/api/scripts/seed-dev.ts` uses Prisma `upsert` to create/refresh alice, bob, charlie with known credentials + verified emails + Blitz rating 1500 + an accepted alice ↔ bob friendship. Idempotent by design (upsert semantics). Runs via `pnpm --filter api seed:dev`.

**No new runtime dependencies.** `tsx` is added as a devDependency only. Postgres and Prisma handle the multi-DB story natively — no schema changes, no new runtime infrastructure.

**Affected systems:**
- `apps/api/package.json` — new scripts (`db:create:test`, `db:migrate:test`, `db:setup:test`, `seed:dev`); `tsx` devDependency.
- `apps/api/.env.example` (if present) + `apps/api/.env` (local) — document optional `DATABASE_URL_TEST` override.
- `apps/api/test/e2e/env-setup.ts` (new) — one-liner that overrides `DATABASE_URL` for the e2e suite.
- `apps/api/vitest.config.ts` — add `setupFiles: ['./test/e2e/env-setup.ts']`.
- `apps/api/scripts/seed-dev.ts` (new) — the idempotent seed script.
- `docker-compose.yml` — mount `./scripts/postgres-init.sql` into `/docker-entrypoint-initdb.d/` so NEW containers auto-create `yanchess_test` on first boot.
- `scripts/postgres-init.sql` (new, at repo root) — one line `CREATE DATABASE yanchess_test;`.
- `context/product/architecture.md` — new §9 or extend §2 with the dev-workflow note.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Add `yanchess_test` database

**For new container boots** (future developers): mount `scripts/postgres-init.sql` into `/docker-entrypoint-initdb.d/` via docker-compose. Postgres official image runs every `.sql` in that directory on first-boot (idempotent — only runs when the data volume is empty).

`scripts/postgres-init.sql`:
```sql
CREATE DATABASE yanchess_test;
```

`docker-compose.yml` postgres volumes block gains one line:
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./scripts/postgres-init.sql:/docker-entrypoint-initdb.d/01-init-test-db.sql:ro
```

**For existing container (dev-API is running against a 3-day-old Postgres volume right now):** the init script will NOT fire — Postgres only runs init-db scripts on an empty data directory. Fallback is a one-shot command:

`apps/api/package.json` → `"db:create:test"`:
```json
"db:create:test": "psql postgresql://yanchess:yanchess@localhost:5432/postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='yanchess_test'\" | grep -q 1 || psql postgresql://yanchess:yanchess@localhost:5432/postgres -c 'CREATE DATABASE yanchess_test'"
```

The command connects to the admin `postgres` DB, checks whether `yanchess_test` exists, and creates it only if missing. Fully idempotent, exits 0 either way.

**Assumption:** psql CLI is available on dev machines. If not, fall back to a Node script that uses `pg` to issue the same statement. The developer-machine prerequisite is already Postgres running in docker; psql is a one-liner `brew install libpq` on macOS and shipped with most Linux distros.

### 2.2 Apply Prisma migrations to `yanchess_test`

`apps/api/package.json` → `"db:migrate:test"`:
```json
"db:migrate:test": "DATABASE_URL=postgresql://yanchess:yanchess@localhost:5432/yanchess_test prisma migrate deploy"
```

Prisma reads `DATABASE_URL` at runtime, so the inline env override points `migrate deploy` at the test DB. No `prisma migrate dev` for the test DB — tests shouldn't generate new migrations; they consume whatever history the dev workflow already produced.

**Convenience wrapper** → `"db:setup:test"`:
```json
"db:setup:test": "pnpm db:create:test && pnpm db:migrate:test"
```

This is the one command a developer runs after a schema change, or on first clone before `test:e2e`.

**Decision:** should `test:e2e` auto-run `db:setup:test` before Vitest spins up?
- **Pro:** zero-touch — tests always find the schema up to date.
- **Con:** adds 1-3 seconds to every test run; obscures what's happening when something fails.
- **Pick: NO auto-run.** `test:e2e` stays fast. The one-time setup is explicit, documented in architecture.md. CI pipeline runs `db:setup:test` once per job as its own step.

### 2.3 Override DATABASE_URL for Vitest e2e suite

Current state: `apps/api/test/e2e/setup.ts` line 15 bootstraps `AppModule`, which transitively instantiates `PrismaClient`, which reads `DATABASE_URL` from `process.env` at that moment.

New file `apps/api/test/e2e/env-setup.ts`:
```ts
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public";
```

Wire into `apps/api/vitest.config.ts` (verify the exact file name — may be `vitest.config.ts` or `vite.config.ts`):
```ts
export default defineConfig({
  // ...existing config...
  test: {
    setupFiles: ["./test/e2e/env-setup.ts"],
    // ...rest unchanged...
  },
});
```

**Why `setupFiles` vs an import at top of `setup.ts`:** Vitest guarantees `setupFiles` run **before any test file is loaded**, including before any transitive import that would create a Prisma client. If we put the override at the top of `setup.ts`, it fires in the right order on current layout but is fragile — someone could reorder imports and break it silently. `setupFiles` is the explicit contract.

**Env var contract:**
- `DATABASE_URL` — dev-API's database, used by `node dist/main.js` and `pnpm --filter api dev`.
- `DATABASE_URL_TEST` — optional override for the e2e suite. If unset, defaults to the hard-coded `yanchess_test` URL above.

CI can set `DATABASE_URL_TEST` explicitly (e.g., pointing at a service-container Postgres with a different hostname). Locally, developers rely on the default and never touch this var.

### 2.4 Dev-user seed script

New file `apps/api/scripts/seed-dev.ts`:

**Dependencies used:**
- `@prisma/client` (already a dep)
- `argon2` (already in the auth stack, used by `RegisterService` or similar)
- `node:crypto` (built-in)
- No new deps.

**Execution runtime:** `tsx` (new devDependency, ~15MB, fastest TS-to-Node loader available). Run as `pnpm --filter api seed:dev` → `tsx scripts/seed-dev.ts`.

**Script logic (describe only, no code):**

| Step | Operation | Notes |
|---|---|---|
| 1 | `const prisma = new PrismaClient()` | Reads `DATABASE_URL` — defaults to dev `yanchess` |
| 2 | For each of alice/bob/charlie: `prisma.user.upsert({ where: { email }, create: {...}, update: { passwordHash: <fresh argon2 hash>, emailVerifiedAt: new Date() } })` | Idempotent. Updating `passwordHash` on every run means the known password `Password123!` always works, even after e2e wiped+recreated users |
| 3 | For each user: `prisma.ratingByMode.upsert({ where: { userId_mode: { userId, mode: 'Blitz' } }, create: { userId, mode: 'Blitz', rating: 1500, gamesPlayed: 0 }, update: {} })` | Only creates on absence; preserves existing rating if user has played real games against the dev-API |
| 4 | Compute canonical pair `(userAId, userBId) = alice < bob ? (alice, bob) : (bob, alice)` | Match schema invariant from spec 007 |
| 5 | `prisma.friendship.upsert({ where: { userAId_userBId: {...} }, create: { ...pair, status: 'accepted', initiatedBy: alice.id, respondedAt: new Date() }, update: { status: 'accepted', respondedAt: new Date() } })` | Idempotent, forces accepted state |
| 6 | `await prisma.$disconnect(); process.exit(0)` | Exit cleanly for CI |

**Error handling:**
- Prisma connection failure → script catches, prints `[seed-dev] cannot connect to <url> — is Postgres running?`, exits code 1.
- Migration out of date (e.g., `Friendship` table doesn't exist) → Prisma throws `P2021` or similar; print `run \`pnpm --filter api prisma:migrate:deploy\` first`, exit 1.
- Any other error → print stack + exit 1.

**Package.json script:**
```json
"seed:dev": "tsx scripts/seed-dev.ts"
```

**Target duration:** < 5 seconds end-to-end. Upserts are small and Postgres is local; argon2 hashing is the slowest part (~300ms per user × 3 = ~900ms). Well under budget.

### 2.5 Documentation note

Add new section `## 9. Dev Workflow` to `context/product/architecture.md`:

Contents (describe only; actual prose written during implementation):
- **Two databases, one Postgres container:** `yanchess` is the dev-API's database (production-like state); `yanchess_test` is a disposable scratch for the e2e suite.
- **Env vars:** `DATABASE_URL` (dev-API, required) and `DATABASE_URL_TEST` (optional override for e2e; default fine locally).
- **Day-one setup:** `docker-compose up -d && pnpm install && pnpm --filter api prisma:migrate:deploy && pnpm --filter api db:setup:test && pnpm --filter api seed:dev && pnpm dev`.
- **Everyday workflow:** `pnpm dev` to start, `pnpm --filter api test:e2e` whenever to run tests (does not touch dev data), `pnpm --filter api seed:dev` to reset dev state after a schema change or if the DB got polluted.
- **After a Prisma migration:** also run `pnpm --filter api db:migrate:test` to keep test schema in sync.

Mark the section `_[Confirmed]_` with reference to spec 009.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Prisma schema + migrations** — unchanged. Both databases run the exact same migration history. No new tables.
- **E2E test fixtures (`resetAll`, user registration helpers)** — unchanged. They operate on whatever `DATABASE_URL` resolves to, which is now `yanchess_test`.
- **Dev-API routes, services, auth** — all unchanged. The dev-API reads `DATABASE_URL` from `apps/api/.env` as today.
- **Redis** — unchanged. The e2e suite already clears its own Redis keys (`mm:*`, `game:*`, etc.) via `resetAll`; those patterns remain safe for the dev-API because the test suite only clears patterns it set up.
  - **Wait — this is a hole.** `resetAll` clears Redis keys regardless of which DB owns the Postgres state. If dev-API has an active matchmaking entry, `test:e2e` would wipe it. Flag as a risk in §3.2 and plan a mitigation.

### 3.2 Potential Risks & Mitigations

- **Redis is still shared.** This spec isolates Postgres only. The dev-API and e2e suite still hit the same Redis instance (`localhost:6379`). If an e2e run clears `game:*` while the dev-API has an active game, that game breaks. Mitigation: either (a) use a separate Redis DB number (Redis 0 for dev, Redis 1 for test — one env var, same server), or (b) scope `resetAll` to a key prefix like `test:*` and update all e2e-reachable code paths to use that prefix. Option (a) is a 2-line change (ioredis `db: 1` option in test setup). **Decision: include Redis DB-index isolation in this spec as part of §2.3** — it's one line, same spirit as the Postgres isolation. Update env-setup.ts to also set `REDIS_URL=redis://localhost:6379/1` (or equivalent syntax used by `apps/api/src/modules/redis/`).
- **Existing Postgres container's `yanchess_test` doesn't exist.** The user's container has been running 3+ days; the init-db script won't fire. `pnpm --filter api db:setup:test` must be run once. Mitigation: document loudly in architecture.md §9 and in the task Verify step. First-time failure of `test:e2e` after this spec will say "database 'yanchess_test' does not exist" — the error is clear enough.
- **Developer forgets to run `db:migrate:test` after a schema change.** Prisma complains at e2e startup with a mismatched-schema error. Mitigation: documentation + consider adding a lightweight schema-version check in `env-setup.ts` that runs `prisma migrate status` and prints a clear hint on mismatch. **Decision: skip for now.** The Prisma error message is clear enough; adding a check in test setup slows every run.
- **Seed script runs against the TEST database by mistake.** If someone sets `DATABASE_URL=postgresql://.../yanchess_test` in their shell env before `pnpm seed:dev`, the seed populates the test DB. Mitigation: at the top of `seed-dev.ts`, check `DATABASE_URL` for the substring `_test` and refuse with a clear error unless an explicit `--allow-test-db` flag is passed. Simple safety net.
- **argon2 hash takes longer than expected.** The seed script hashes 3 passwords. argon2 default params are ~300ms each. Total < 1s. Not a concern.
- **`tsx` adds ~15MB to node_modules.** Standard tool, trusted maintainer (@antfu). Trade-off worth it for TS-native script execution.

### 3.3 Deployment / Runtime impact

- **Local dev:** `docker-compose up` + `pnpm install` + first-time `db:setup:test` + `seed:dev` are the one-time ritual. After that, `pnpm dev` and `test:e2e` are decoupled.
- **CI:** job needs `db:setup:test` step before `test:e2e`. Likely a single new line in `.github/workflows/*.yml`.
- **Production / staging:** zero impact. These environments don't run e2e tests and don't ship a seed script.
- **Rollback:** revert the vitest.config.ts and remove the env-setup.ts file; test suite falls back to using `DATABASE_URL` directly. No data destruction either way.

---

## 4. Testing Strategy

### 4.1 Backend — Vitest

**Unit** (`apps/api/test/unit/seed-dev.spec.ts`):
- Mock Prisma. Call the seed script's main function.
- Assert: three `user.upsert` calls, one per email.
- Assert: one `friendship.upsert` call with canonical ordering.
- Assert: three `ratingByMode.upsert` calls.
- Assert: idempotency — call main() twice, assert same number of upserts and no `create` fallbacks (upsert's internal detail — alternatively, assert zero `prisma.user.create` direct calls).

**E2E regression** (reuse existing suite):
- All 74 e2e tests must still pass against `yanchess_test`.
- Add one new assertion: before e2e runs, insert a canary row into dev `yanchess.users` (via a separate script); after `test:e2e` completes, confirm the canary row still exists and is untouched. This is the headline isolation proof. Can be done as a shell-level test in CI or a once-off manual verify.

### 4.2 Manual verification (Verify slice)

- Fresh clone → `docker-compose up -d && pnpm install && pnpm --filter api prisma:migrate:deploy && pnpm --filter api db:setup:test && pnpm --filter api seed:dev && pnpm dev` — end state: alice can sign in at http://localhost:5173 with `Password123!` and sees bob in Friends.
- Pollute dev state: register a new user via UI, friend them.
- Run `pnpm --filter api test:e2e` — expect all 74 tests pass.
- Reload http://localhost:5173 as the polluted user — must still be signed in, still have the friend. Dev state untouched.

### 4.3 Regression check

- All 73+ unit tests, 74 e2e tests, 252 web tests remain green.
- Specs 001-008 behavior unaffected — no app-code changes.
