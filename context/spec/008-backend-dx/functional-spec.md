# Functional Specification: Backend developer experience — restored build pipeline and simplified module wiring

- **Topic:** Developer-facing tooling and module wiring for the YanChess API — restoring the standard build command with hot-reload, and reshaping the module graph so adding a new feature does not require threading circular-dependency workarounds through three or more existing modules.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

The YanChess API accumulated two developer-experience debts over specs 001-007 that compound every new feature's cost.

**Build pipeline:** the standard NestJS build + watch command fails silently in `apps/api`. The team fell back to a manual TypeScript compile step and a hand-restarted process on every code change. Each API tweak now costs a 10-15 second rebuild + restart cycle with no incremental compile and no hot-reload. The decorator metadata that drives dependency injection and route registration is also being emitted by the raw TypeScript compiler rather than the NestJS CLI, which risks subtle divergence from the framework's expected build output.

**Module wiring:** the Friends and Game modules share five services that mutually depend on each other through a chain of circular-dependency workarounds (five `forwardRef` injections plus `forwardRef` on the module `imports:` lists). Each new provider added anywhere in that cluster has to repeat the same pattern, and one mistake brings down the whole API at startup with a "Nest can't resolve dependencies" error. Any next feature that needs to emit socket events or read presence (public profiles, chat, spectate, tournaments) will land in this cluster and inherit the fragility.

**Problem for the developer:** the next feature takes 20-40 minutes longer than it should — rebuild/restart loops burn minutes across the day, and the dependency-injection tangle demands an archaeology pass before any socket-related work. Shipping velocity drops.

**How we measure success:**
- The dev loop from "save a file" to "see the change in a running API" is **under 2 seconds** (hot-reload path).
- A developer can add a new feature module that emits socket events **without** modifying the circular-dependency workaround list in Friends, Game, or Presence modules.
- The standard build + watch command runs end-to-end with no manual fallback step.

---

## 2. Functional Requirements (The "What")

### 2.1 Standard backend build and dev-loop

- **As** a backend developer, **I want** the project's standard build and watch commands to work out of the box, **so that** I get incremental compilation and hot-reload instead of a hand-rolled rebuild script.
  - Running the documented "dev" command from the project root starts the API with file-watching and hot-reload. A save in any source file triggers a sub-2-second reload of the affected modules.
  - Running the documented "build" command produces a `dist/` folder with the metadata the framework needs for dependency injection and route registration — no manual TypeScript invocation required.
  - If any CI job or dev workflow currently uses the hand-rolled `pnpm exec tsc` + `node dist/main.js` path, it continues to boot the API; this requirement is additive. That hand-rolled path may be removed once nothing else references it.
  - **Acceptance Criteria:**
    - [x] Given a developer runs the project's documented API dev command, when the API finishes starting, then they see a log line confirming the API is listening on its port **and** a message that file-watching is active.
    - [x] Given the dev command is running and a developer saves a change to any file under `apps/api/src/`, when the reload finishes, then the change is visible in the running API within 2 seconds (verified by hitting an endpoint that reflects the change).
    - [x] Given a developer runs the project's documented API build command from a clean state, when the command finishes, then it exits with code 0 and produces a `dist/` folder; the API started from that `dist/` boots with all modules initialized and no "Nest can't resolve dependencies" error.
    - [x] Given the dev command is already running and a developer introduces a syntax error in `apps/api/src/`, when the reload fails, then the terminal shows the compile error without killing the watch process; fixing the error triggers a clean reload automatically.

### 2.2 Clean module wiring for socket-emitting features

- **As** a backend developer adding a new feature that emits socket events or reads online presence, **I want** to wire my new module into the shared socket + presence facilities without threading circular-dependency workarounds through the existing Friends, Game, or Presence modules, **so that** adding a feature is a local change instead of a cross-module refactor.
  - The current cluster of five services that mutually depend on each other through workarounds is reshaped so that no service needs to know about the gateway class or module of any other feature. Each service imports a single shared facility to emit events or read presence, and that facility has no circular dependency back to its callers.
  - A new feature module (e.g., future "public profile", "spectate", "chat") that needs to emit a socket event or check whether a user is online can do so by injecting one shared service only, without editing any file outside its own module directory.
  - All existing socket namespaces, event names, event payloads, and REST responses stay byte-identical. The refactor is invisible to the frontend and to any external consumer.
  - **Acceptance Criteria:**
    - [x] Given a developer adds a new feature module whose service emits a socket event to a user's room, when the API boots, then the module loads with no `forwardRef` on its `imports:` list and no `forwardRef` on its service constructor, and no file outside the new module directory is modified.
    - [x] Given the refactor is complete, when a developer runs `grep -rn "forwardRef" apps/api/src/modules/friends/ apps/api/src/modules/game/`, then the result shows zero occurrences in the Friends/Game/Presence cluster.
    - [x] Given the refactor is complete and the full backend test suite is run (`pnpm --filter api test:unit` and `pnpm --filter api test:e2e`), when the suites finish, then all tests pass with at least the same counts as before the refactor (currently 59 unit + 74 e2e).
    - [x] Given a smoke pass exercises the happy path of each spec 001-007 feature after the refactor (login, hotseat move, matchmaking game, vs-bot move, game-history open, friend request send + accept, challenge send + accept), when the smoke finishes, then every observed behavior matches the pre-refactor behavior — same emitted socket events, same REST responses, same navigation outcomes.

### 2.3 Documented "how to add a feature module" pattern

- **As** a developer onboarding to the backend or returning after time away, **I want** a short, discoverable note describing the current module-wiring convention, **so that** I follow the new pattern instead of reintroducing the circular-dependency workaround that was just removed.
  - The convention is documented in a place the project already uses for developer notes (CLAUDE.md, README, or `context/product/architecture.md` — whichever matches the project's existing docs discipline).
  - The note names the shared facility, shows a minimal injection example, and spells out the "do not add forwardRef to the cluster" rule.
  - **Acceptance Criteria:**
    - [x] Given a developer greps the repo for a phrase like "feature module" or "socket emit", when they look at the top-level docs, then they find at least one short section (max one screen of text) describing how to inject the shared socket/presence facility in a new module.
    - [x] Given a developer follows the documented example, when they create a minimal "hello-world" feature module that emits one socket event, then the module boots the API with no `forwardRef` and no edits outside its own directory.

---

## 3. Scope and Boundaries

### In-Scope

- Restoring the standard NestJS build + watch commands with hot-reload for the API dev loop.
- Reshaping the Friends/Game/Presence module wiring so that adding a new socket-emitting feature does not require touching more than its own module.
- Documenting the new "how to add a feature module" pattern in whatever place the project keeps developer docs.
- Preserving all current runtime behavior — same socket namespaces, same events, same REST responses, same navigation.

### Out-of-Scope

- Any new user-visible features.
- Performance work: nickname-search trigram index, presence fan-out debouncing, challenge-expiry sweeper rewrite — tracked separately.
- Frontend changes of any kind.
- Database schema changes or Prisma model edits.
- Changes to Redis keys, TTLs, or data structures.
- Changes to authentication, JWT handling, or guards.
- CI pipeline overhaul; only the local dev loop needs to work. CI is only touched if the refactor would otherwise break it.
- Introducing a new runtime dependency, framework, or process manager (nodemon, pm2, concurrently, etc.) beyond what NestJS CLI already ships. If something new is needed, it is called out in the tech spec and approved separately.

---

## Change Log

_No amendments yet._
