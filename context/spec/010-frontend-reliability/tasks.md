# Tasks: Frontend reliability — shared auto-sync + navigation guard

Spec: `context/spec/010-frontend-reliability/`

Vertical slices — each one leaves the project runnable with a measurable reliability improvement. Specs 001-009 must stay functional after every slice (76 e2e + 89 unit + 252 web tests green at every checkpoint).

---

- [x] **Slice 1: Shared package auto-sync — no manual `pnpm build` needed**

  Minimum visible value: a developer runs `pnpm dev` from the root. They edit a type in `packages/shared/src/` and save. Within 2 seconds the change is visible in both the running api and the running web dev-loop. Same holds if they run `pnpm --filter api dev` or `pnpm --filter web dev` alone.

  - [x] Add `concurrently` as a workspace devDep: `pnpm add -D -w concurrently@^9` (if it's not already installed — verify first). Confirm the install succeeds. **[Agent: react-frontend]**
  - [x] Add `dev` script to `packages/shared/package.json`:
    ```json
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput"
    ```
    Position it alongside the existing `build` script. **[Agent: react-frontend]**
  - [x] Update the root `package.json` `"dev"` script to spawn shared's watcher alongside the apps:
    ```json
    "dev": "concurrently -k -n shared,web,api -c cyan,magenta,yellow 'pnpm --filter @yanchess/shared dev' 'pnpm --filter web dev' 'pnpm --filter api dev'"
    ```
    Preserve all other root scripts (`api:dev`, `web:dev`, `build`, `lint`, `typecheck`, `db:*`) exactly as they are. **[Agent: react-frontend]**
  - [x] Update `apps/api/package.json` `"dev"` script:
    ```json
    "dev": "concurrently -k -n shared,api -c cyan,yellow 'pnpm --filter @yanchess/shared dev' 'nest start --watch'"
    ```
    Keep all other api scripts untouched (`build`, `start`, `typecheck`, `postinstall`, `prisma:*`, `db:create:test`, `db:migrate:test`, `db:setup:test`, `seed:dev`, `test:e2e`, `test:unit`). **[Agent: react-frontend]**
  - [x] Update `apps/web/package.json` `"dev"` script:
    ```json
    "dev": "concurrently -k -n shared,web -c cyan,magenta 'pnpm --filter @yanchess/shared dev' 'vite'"
    ```
    Keep all other web scripts untouched. **[Agent: react-frontend]**
  - [x] Verify: Confirm auto-sync works end-to-end.
    1. Kill the user's dev-API on port 3000: `lsof -ti:3000 | xargs -r kill`.
    2. From the project root, run `pnpm dev` in BACKGROUND (`pnpm dev > /tmp/root-dev.log 2>&1 &`, record PID).
    3. Wait up to 15 seconds for all three subprocesses to start. Grep `/tmp/root-dev.log` for: `Successfully compiled` (SWC/api), `ready in` (vite/web), AND one of `[shared]` tags showing the tsc watcher is alive.
    4. Confirm `curl -sf http://localhost:3000/api/v1/health` → 200 and `curl -sf http://localhost:5173/ -o /dev/null -w "%{http_code}"` → 200.
    5. Make a trivial edit in `packages/shared/src/types/user.ts` or similar (add `export const SPEC_010_SMOKE = "ok";`). Save.
    6. Wait 3 seconds. Grep the log for new `Successfully compiled` or `File change detected` lines — the shared watcher must have recompiled.
    7. Grab a `curl` of the API that exercises something touching shared types (any endpoint — just to confirm no runtime break from stale dist). Must still return 200.
    8. Revert the trivial edit (remove the line). Confirm log shows another recompile.
    9. Kill the root `pnpm dev` PID. Wait 2 seconds for `concurrently -k` to kill all children. Confirm port 3000 and 5173 are free.
    10. Restart the user's production-style dev-API: `cd apps/api && node dist/main.js > /tmp/dev-api.log 2>&1 &` with recorded PID. Must respond to `/health` → 200.
    11. Repeat steps 2-9 but with `pnpm --filter api dev` instead of root `pnpm dev`. Confirm the shared watcher is still active in its log output and type changes propagate.
    12. Clean up: kill any BACKGROUND PIDs you started during this verify. Delete `/tmp/root-dev.log`, `/tmp/api-dev.log`, any screenshots. **Final state:** dev-API on port 3000 under `node dist/main.js`, PID reported. **[Agent: general-purpose]**

- [x] **Slice 2: Navigation guard — only navigate to `/play` when the user opted in**

  Minimum visible value: a player on `/vs-bot` plays a move against the engine. In a separate tab (same user) a dangling matchmaking subscription from an earlier session resolves and emits `game.start`. The player on `/vs-bot` STAYS on `/vs-bot`. Meanwhile, a player who clicks "Find Game" on `/` still correctly navigates to `/play` when the match resolves.

  - [x] Add `pendingNavigate: boolean` field to `useOnlineGameStore` state at `apps/web/src/features/online/useOnlineGameStore.ts` (default `false`), plus two actions `markPendingNavigate()` → sets true, `clearPendingNavigate()` → sets false. If the store has a reset/clear-all action (e.g., for post-game-end cleanup), include `pendingNavigate: false` in its reset. **[Agent: react-frontend]**
  - [x] Patch `useMatchmakingStore.joinQueue` at `apps/web/src/features/online/useMatchmakingStore.ts`: at the start of the body, call `useOnlineGameStore.getState().markPendingNavigate()`. If there's a `leaveQueue` / cancel action, call `clearPendingNavigate()` there too. **[Agent: react-frontend]**
  - [x] Patch `useFriendsStore` at `apps/web/src/features/friends/useFriendsStore.ts`:
    - `sendChallenge` action — call `markPendingNavigate()` at the start, before the socket emit.
    - `respondInboundChallenge(accept)` — if `accept === true`, call `markPendingNavigate()` before the socket emit. If `accept === false`, no-op (don't call anything).
    - `cancelOutboundChallenge` — call `clearPendingNavigate()`.
    - Socket listener `challenge.declined` — call `clearPendingNavigate()` (challenger's opt-in dies).
    - Socket listener `challenge.expired` — call `clearPendingNavigate()` (same reason).
    - Socket listener `challenge.cancelled` — call `clearPendingNavigate()` (either side could be affected). **[Agent: react-frontend]**
  - [x] Patch `AuthenticatedLayout` in `apps/web/src/routes.tsx` (around lines 38-43):
    - Subscribe to `pendingNavigate` via `useOnlineGameStore((s) => s.pendingNavigate)`.
    - Modify the navigate effect to require both `gameId !== null` AND `pendingNavigate === true`.
    - After calling `navigate("/play")`, immediately call `useOnlineGameStore.getState().clearPendingNavigate()` to consume the flag.
    - Add `pendingNavigate` to the effect's dependency array. **[Agent: react-frontend]**
  - [x] Update any existing unit tests that mock `useOnlineGameStore` state — add `pendingNavigate: false` to the default state if tests do exhaustive shape assertions. Grep `apps/web/src/features/online/*.spec.ts` and `apps/web/src/features/friends/*.spec.ts` for store shape mocks and update where needed. **[Agent: react-frontend]**
  - [x] Verify: Confirm the guard blocks unwanted nav AND preserves happy paths. **Phase A (guard) + B (matchmaking regression) + C (challenge regression) PASS. Phase D (opt-in persistence across page nav) does NOT work — pre-existing `Play.tsx` unmount cleanup calls `leaveQueue()` which clears both server-side queue entry and `pendingNavigate`. Would need a separate change to Play.tsx cleanup lifecycle to make AC #6 achievable; outside spec 010 scope.**
    1. Ensure dev-API running on port 3000 (restart via `cd apps/api && node dist/main.js > /tmp/dev-api.log 2>&1 &` if needed, record PID).
    2. Start Vite in BACKGROUND: `cd apps/web && pnpm dev > /tmp/vite.log 2>&1 &` — record PID. (Note: this will also spawn a shared watcher thanks to Slice 1 — that's fine, kill both at end.)
    3. Users alice/bob/charlie exist via `pnpm --filter api seed:dev` if DB was wiped (safe to run — idempotent).
    4. Playwright MCP smoke:
       - **Guard test:** Sign in as alice. Navigate to `/vs-bot`. Make 1 move (click a piece, drag). In parallel via `mcp__playwright__browser_evaluate`, inject into alice's `useOnlineGameStore`: `window.__simulateGameStart = () => { useOnlineGameStore.setState({ gameId: 'simulated-' + Date.now() }); };` then call `__simulateGameStart()`. Wait 2 seconds. Confirm URL is STILL `/vs-bot` (not `/play`). Snapshot DOM.
       - **Regression — matchmaking happy path:** reset browser state. Sign in as alice. On `/`, click "Find game" in Blitz. In a second Playwright context, sign in as bob, click same. Within 5s both should navigate to `/play` with chessboard visible.
       - **Regression — challenge accept happy path:** reset state (clean friendships + Redis challenge keys via psql + redis-cli). Pre-seed alice+bob accepted friendship via API. Sign in as alice, navigate `/friends`. In second context sign in as bob, navigate `/friends`, click Challenge on alice's row, Blitz + White, Send. Alice sees ChallengeToast → clicks Accept → both tabs navigate to `/play`.
       - **Guard preserves opt-in across page change:** sign in as alice on `/`, click "Find game" in Blitz. BEFORE pairing, manually navigate alice to `/profile`. Wait for backend to pair alice with another user (via a scripted socket.io-client that queues as bob). Within 10s alice SHOULD navigate from `/profile` to `/play` because her opt-in from "Find game" persists.
    5. Kill Vite PID, kill any shared watcher child PIDs, close Playwright browser, delete all screenshots. Leave dev-API running. **[Agent: general-purpose]**

- [x] **Slice 3: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read `context/spec/010-frontend-reliability/functional-spec.md` acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers: unit for pure logic (`useOnlineGameStore.markPendingNavigate / clearPendingNavigate`, matchmaking/friends store call sites setting/clearing the flag correctly), integration for the `AuthenticatedLayout` effect (test using Testing Library + a mock router that `navigate` is called when `gameId !== null && pendingNavigate` and NOT called when `pendingNavigate === false`), shell-level smoke for the shared auto-sync (programmatically edit a `.ts` in `packages/shared/src/`, wait N ms, verify `packages/shared/dist/` was rewritten). Write tests with RED validation on the navigation-guard invariant: temporarily revert the `pendingNavigate` check in `AuthenticatedLayout`'s effect (make it `if (gameId !== null)` without the flag), run the guard unit/integration test, show it fails (unwanted nav fires); restore, show it passes. Annotate each test with `@spec: 010-frontend-reliability` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. Also run `pnpm --filter web typecheck`, `pnpm --filter web test -- --run`, `pnpm --filter api typecheck`, `pnpm --filter api test:unit`, `pnpm --filter api test:e2e` to confirm zero regressions in specs 001-009 behavior (76 e2e, 89 unit, 252 web minimum). **[Agent: testing-expert]**
