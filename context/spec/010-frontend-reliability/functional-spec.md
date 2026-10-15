# Functional Specification: Frontend reliability — shared package auto-sync and protected-page navigation guard

- **Topic:** Two unrelated reliability fixes that touch the frontend ecosystem — making the shared types package stay in sync without a manual rebuild step, and preventing the online-game auto-navigation from yanking players out of pages they are actively using (vs-bot, history replay, profile).
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Two independent problems compound the cost of every new feature.

**Problem 1 — shared types drift silently.** The `@yanchess/shared` package ships both source TypeScript and compiled JavaScript (in a `dist/` folder). The web app and the API both consume the compiled output. Today, when a developer edits a type in `packages/shared/src/`, nothing automatically rebuilds `packages/shared/dist/`. TypeScript's language server still sees the fresh types from source (so typecheck looks fine), but Node/Vite consume stale JavaScript from `dist/` at runtime. The failure mode is confusing: typecheck passes, tests pass, then runtime fails somewhere far from the actual mismatch with errors like "undefined is not a function" that point at the wrong file. We hit this three times across specs 007-008 and each time it ate 10-20 minutes to find.

**Problem 2 — the online-game auto-navigate fires on the wrong pages.** When a player is in the online matchmaking queue or has a pending challenge, the moment the backend creates a game the frontend transitions `useOnlineGameStore.gameId` from `null` to the new id. An effect in the authenticated layout catches that transition and routes the player to `/play`. That is correct when the player is on `/` or `/friends` and is actively waiting for a match. It is wrong when the player is somewhere else entirely — mid-move against the Stockfish bot on `/vs-bot`, studying a replay on `/history/:gameId`, or changing settings on `/profile`. In those cases the player gets yanked out of their current task. We haven't seen the bug trigger in production yet, but it is a timing bomb: it will fire the first time someone leaves a matchmaking queue entry dangling and does something else.

**Problem for the developer and the end user:**
- Every type change costs 5-20 minutes of debugging when a developer forgets `pnpm --filter @yanchess/shared build`.
- Every player with a dangling online-game subscription loses whatever they were doing the moment that subscription resolves.

**How we measure success:**
- A developer can edit any type in `packages/shared/src/` and see the change land in `apps/api` and `apps/web` dev servers **without running any extra command**. The web page or API endpoint reflects the new type on the next request after a save, within **under 2 seconds**.
- A player on `/vs-bot`, `/history/*`, or `/profile` whose online matchmaking subscription happens to resolve in the background **stays on their current page**. No redirect fires. Their in-progress state (bot move, replay position, profile edit) is preserved.
- A player who clicked "Find Game" in matchmaking or accepted a challenge **is still correctly navigated to `/play`** when the backend produces a game. The happy path from specs 004 and 007 is unchanged.

---

## 2. Functional Requirements (The "What")

### 2.1 Shared types stay in sync automatically

- **As** a developer, **I want** the shared types package to be rebuilt automatically whenever I edit its source, **so that** I never run `pnpm --filter @yanchess/shared build` by hand and never debug a mysterious runtime error caused by stale compiled output.
  - Running `pnpm dev` at the project root starts the frontend, backend, AND a watch mode on the shared package. All three keep running concurrently.
  - Running `pnpm --filter api dev` or `pnpm --filter web dev` individually also triggers the shared watch — no shell is left without it.
  - When any file under `packages/shared/src/` is saved, the compiled output in `packages/shared/dist/` is refreshed within **2 seconds**. The web dev server and the API dev-loop pick up the new output on their next incremental reload (which they already do for other source changes).
  - CI and production builds (`pnpm build` at the project root, or the deployment pipeline) continue to produce a correct one-shot build of the shared package before the dependent apps build. No regression in artifact correctness.
  - **Acceptance Criteria:**
    - [x] Given a developer has `pnpm dev` running from the project root, when they add a new exported type to any file under `packages/shared/src/` and save it, then within 2 seconds the type is importable from `apps/web` and `apps/api` without any additional command.
    - [x] Given a developer runs only `pnpm --filter api dev`, when they edit a shared type, then the API dev-loop picks up the change within 2 seconds (either because shared's watch is auto-started as a dependency, or because the api dev script explicitly runs them together).
    - [x] Given a developer runs only `pnpm --filter web dev`, when they edit a shared type, then the web dev server picks up the change within 2 seconds — same reason.
    - [x] Given a developer runs the production build command (`pnpm build` or whatever the project uses), when the build finishes, then the output is identical in correctness to what a manual sequential `pnpm --filter @yanchess/shared build && pnpm --filter web build && pnpm --filter api build` would produce.
    - [x] Given a developer deletes a type from `packages/shared/src/` and saves, when the next consumer imports it, then they get a clear compile-time error pointing at the deletion — not a runtime "undefined" error.

### 2.2 Online-game auto-navigation only fires when the player intended it

- **As** a player who is doing something other than waiting for an online match, **I want** the app to leave me alone when a dangling matchmaking or challenge subscription happens to resolve, **so that** I don't lose my in-progress state.
  - When a player clicks "Find Game" in matchmaking (spec 004) or clicks Accept on a friend's challenge (spec 007), the resulting online game must still auto-navigate both players to `/play`. This is the intended happy path and must not regress.
  - When a player is on `/vs-bot`, `/history/*`, `/profile`, or any other authenticated page AND they did NOT click "Find Game" or accept a challenge during the current page visit, the app does NOT redirect them to `/play` even if the backend creates an online game in their name. (That shouldn't happen in practice because they didn't request one, but defensive guard — the latent bug is specifically about dangling subscriptions from a prior page visit.)
  - If a player clicked "Find Game" or accepted a challenge and then navigated away from `/` or `/friends` to a different page while the backend was still working, the redirect to `/play` is still correct behavior — the player opted in. The guard only blocks the redirect when there was no opt-in signal in the current session.
  - **Acceptance Criteria:**
    - [x] Given a player is on `/vs-bot` playing against the engine, when a background socket event delivers an online game id (simulated or real), then the player stays on `/vs-bot`. The bot game is unaffected. No navigation occurs.
    - [x] Given a player is on `/history/:gameId` reviewing a replay, when a background socket event delivers an online game id, then the player stays on `/history/:gameId`. The replay position is preserved. No navigation occurs.
    - [x] Given a player is on `/profile` editing something, when a background socket event delivers an online game id, then the player stays on `/profile`. Any in-progress form data is preserved. No navigation occurs.
    - [x] Given a player clicks "Find Game" in the Blitz mode on the home page, when the backend pairs them with an opponent and emits `game.start`, then they are navigated to `/play` and see the chessboard. (Regression check — spec 004 behavior preserved.)
    - [x] Given alice has bob as a friend and clicks the challenge accept banner on `/profile`, when the backend creates the game, then alice IS navigated to `/play` because she explicitly accepted. (Regression check — spec 007 behavior preserved.)
    - [ ] Given a player clicked "Find Game" on `/` and then navigated to `/profile` while still waiting (via browser Back button or an explicit link), when the match is found 10 seconds later, then they are still correctly navigated to `/play` — the opt-in signal persists for the duration of that queue entry's lifetime. _**Deferred — see Change Log 2026-10-15.**_

---

## 3. Scope and Boundaries

### In-Scope

- Making `packages/shared` build output stay in sync with its source during local development, through whatever mechanism the project's build tooling best supports (watch mode, workspace project references, auto-triggered rebuild — pick in tech spec).
- Adding a provenance signal to the online-game-start flow so the auto-navigation can tell "the player asked for this" from "the player did not".
- Preserving the exact happy-path behavior of matchmaking (spec 004) and friend challenge (spec 007).
- Preserving CI / production build correctness.

### Out-of-Scope

- Backend performance work: nickname trigram index, presence fan-out batching, challenge-expiry sweeper rewrite — tracked separately.
- Frontend error observability (Sentry, custom beacon endpoints for `window.onerror`) — tracked separately as its own larger spec.
- Deduplication of socket-singleton boilerplate between `apps/web/src/features/online/socket.ts` and `apps/web/src/features/friends/friends-socket.ts` — cosmetic, deferred.
- Any changes to Prisma schema, Redis keys, backend module structure, or socket event names/payloads.
- Any larger Zustand store shape overhaul beyond adding one new field or provenance marker on `useOnlineGameStore`.
- Any new runtime dependency on either the web or api side. If the fix needs a devDependency (e.g., a workspace-wide watcher), that is called out in the tech spec and approved separately.
- Any change to how matchmaking, challenges, or games are created server-side.
- Any change to the UI of `/vs-bot`, `/history/*`, or `/profile` themselves — only the guard against unwanted navigation away from them.

---

## Change Log

- **2026-10-15 — AC §2.2 #6 deferred (option A: accept gap).** During /awos:verify, acceptance criterion §2.2 #6 ("Find Game on `/` → navigate to `/profile` → match found → auto-navigate to `/play`") was discovered to be unachievable within this spec's scope. The pre-existing `Play.tsx` unmount cleanup (`apps/web/src/pages/Play.tsx:46-52`) calls `useMatchmakingStore.leaveQueue()` whenever the player navigates away from `/play` while in the searching phase — which both removes the server-side queue entry AND clears `pendingNavigate`. Keeping the queue entry alive across page navigation would require a separate product decision (what should "I navigated away" mean while searching?) plus a lifecycle refactor. Explicitly accepted: current UX "navigate away = cancel search" is the intended default. Opt-in persistence across navigation is a future enhancement, not a bug in this spec. All other 10 ACs met and verified; spec moved to Completed with this one deferred.
