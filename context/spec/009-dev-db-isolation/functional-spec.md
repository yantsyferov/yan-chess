# Functional Specification: Dev DX — isolate e2e test database from the demo database and add a dev-user seed script

- **Topic:** Developer-facing isolation between the test database (where e2e suites can safely truncate anything) and the demo database (where alice/bob/charlie live for manual sessions), plus a one-command seed that populates the demo database with a known starting state.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Two intertwined problems make the dev workflow drag.

**Problem 1 — e2e wipes the demo database.** The e2e test suite calls a `resetAll` fixture in `beforeEach` that truncates the `users` table (CASCADE) in the same Postgres database (`yanchess`) the dev-API uses to serve `http://localhost:3000`. Wiping is correct test hygiene — tests need a clean slate to stay deterministic — but it collides with any live demo session. After every `pnpm --filter api test:e2e` a developer must re-register alice/bob/charlie, pull verification tokens out of `apps/api/dev-outbox/`, verify each email, and (if the next step needs friends) re-send + re-accept friend requests. This friction bit us 5-6 times across spec 007 and spec 008 verification sessions and shows up every time we run tests before a demo.

**Problem 2 — no reproducible way to populate the dev database.** Today each developer registers alice/bob/charlie by hand through the UI or curl, verifies emails by reading JSON files, and sets up friendships through the API. Passwords, nicknames, and starting states (e.g., "alice and bob are accepted friends, charlie is a lonely third party") live in session memory, not in code. A new developer joining the project has no one-command way to reach a known demo-ready state.

**Problem for the developer:** every demo-plus-test workflow costs 2-5 minutes of manual re-provisioning. Multiplied across every verify pass, every bug repro, every onboarding, it adds up.

**How we measure success:**
- Running `pnpm --filter api test:e2e` does NOT change any row the dev-API can see. The dev-API's view of its database is byte-identical before and after an e2e run.
- Running the documented seed command on an empty dev database produces alice, bob, charlie, and the alice ↔ bob friendship in under **5 seconds**.
- Re-running the same seed command on an already-seeded dev database succeeds (idempotent) and leaves the data unchanged.

---

## 2. Functional Requirements (The "What")

### 2.1 Isolated test database for e2e runs

- **As** a backend developer, **I want** the e2e test suite to use a database that is completely separate from the one my dev-API serves, **so that** running tests does not destroy my demo state.
  - Running `pnpm --filter api test:e2e` must leave every row the dev-API can read unchanged. Users, games, ratings, friendships, Redis state used by the dev-API's active sessions — all unaffected.
  - The e2e suite retains full freedom to truncate, insert, and reset its own data in whatever way the tests require. Deterministic test runs stay the priority.
  - If a developer accidentally points the dev-API at the test database (e.g., misconfigured env var), nothing is lost — the test database is throwaway by design.
  - The test database can live in the same Postgres server as the dev database or in a separate container — the choice is a technical decision and does not affect this requirement.
  - **Acceptance Criteria:**
    - [x] Given a dev-API is running against the demo database with alice registered and verified, when a developer runs `pnpm --filter api test:e2e` and it completes, then the dev-API still has alice in its users table with the same id and password hash as before.
    - [x] Given a dev-API has an in-progress online game between two players in Redis, when `pnpm --filter api test:e2e` runs and finishes, then that game state is still readable by the dev-API (the e2e suite did not touch the dev-API's Redis keys).
    - [x] Given a developer opens two shells — shell A runs `pnpm --filter api test:e2e` while shell B hits `curl http://localhost:3000/api/v1/users/me` with alice's token — then shell B's responses remain consistent with the pre-test state throughout the e2e run.
    - [x] Given the e2e suite finishes successfully, when the test counts are compared, then they are the same as before isolation (currently 74 e2e passing) — isolation did not break any test.

### 2.2 One-command dev-user seed

- **As** a backend developer (or a new teammate on day one), **I want** a single documented command that populates the dev database with a known set of test users and relationships, **so that** I can go from a cold-start empty database to a demo-ready state in one step.
  - Running the seed command produces:
    - **alice** — email `alice@test.local`, password `Password123!`, nickname `alice`, email verified, Blitz rating 1500.
    - **bob** — email `bob@test.local`, same password, nickname `bob`, email verified, Blitz rating 1500.
    - **charlie** — email `charlie@test.local`, same password, nickname `charlie`, email verified, Blitz rating 1500.
    - An **accepted friendship between alice and bob** so the Friends feature has visible data on day one.
  - The command is idempotent: running it on an already-seeded database succeeds and leaves the data unchanged. It never duplicates users, never flips a verified email to unverified, never wipes other data.
  - The command completes in under 5 seconds on a developer laptop against a local Postgres.
  - If any of the three users exists with a mismatching password hash (e.g., left over from a previous e2e run that happened before isolation), the command updates the hash to match `Password123!` so sign-in works. The user id and verification status are preserved where possible.
  - The command fails loudly (non-zero exit, clear error) if the dev database is unreachable or Prisma migrations are out of date.
  - **Acceptance Criteria:**
    - [x] Given an empty dev database, when a developer runs the documented seed command, then within 5 seconds the database contains alice, bob, and charlie (all verified) plus one accepted friendship row between alice and bob.
    - [x] Given the seed command just completed successfully, when a developer re-runs the same seed command, then it exits with code 0 and the row counts in the users and friendships tables are unchanged.
    - [x] Given a developer runs the seed command then signs in via the UI as alice / `Password123!`, when the sign-in request succeeds and they open `/friends`, then they see bob in their Friends tab with a presence dot.
    - [x] Given the Postgres container is down and a developer runs the seed command, when the command tries to connect, then it exits with a non-zero code and prints a clear error message pointing at the connection failure.

### 2.3 Documented developer workflow

- **As** a developer onboarding or returning after time away, **I want** a short, discoverable note describing both the test-vs-demo DB split and the seed command, **so that** I use the correct database for each workflow and know how to recover demo state after a test run.
  - The note is placed in a developer-facing location the project already uses (README, `architecture.md`, or a dedicated `CONTRIBUTING.md`-style file — whichever matches the project's existing docs discipline).
  - The note names:
    - Which env var the dev-API reads for its database connection.
    - Which env var or file the e2e suite reads for its (separate) database connection.
    - The exact seed command and what it produces.
    - A one-line recovery recipe: "after `test:e2e` destroyed my demo state" (answer: it didn't; if you want to reset dev state, run the seed command).
  - **Acceptance Criteria:**
    - [x] Given a developer greps the repo for words like "seed", "test database", or "demo users", when they look at top-level docs, then they find a section (max one screen of text) describing the test/dev DB split and the seed command.
    - [x] Given a new developer follows the documented steps on a fresh clone, when they finish the "day one setup" sequence, then they can sign in as alice at `http://localhost:5173` with password `Password123!` and see bob in Friends.

---

## 3. Scope and Boundaries

### In-Scope

- Introducing a separate database (or logical schema) for the e2e test suite so `pnpm --filter api test:e2e` cannot touch the dev-API's data.
- Adding an idempotent seed command for the dev database that produces alice, bob, charlie, and the alice ↔ bob friendship.
- Preserving all existing e2e test behavior — same assertions, same test counts, same fixtures — but against the test database.
- Documenting the split and the seed command in developer-facing docs.
- Updating the local docker-compose or Postgres container setup if needed to make the two databases available.

### Out-of-Scope

- Any changes to production or staging database configuration.
- Any changes to backend application code (routes, auth, schema, services, Prisma models).
- Any changes to e2e test content beyond the database connection they resolve to.
- Frontend changes of any kind.
- CI pipeline overhaul; CI's e2e job can be updated to point at the test DB, but no other CI changes are in scope.
- Introducing a new runtime dependency, framework, or orchestration tool. If a seed script needs a library beyond what Prisma + the existing `apps/api` codebase already ships, it is called out in the tech spec and approved separately.
- Changes to how dev-outbox email verification tokens work.
- Any change to passwords, nicknames, or starting ratings for the three seeded users — exact values listed in §2.2 are fixed.

---

## Change Log

_No amendments yet._
