# Technical Specification: Frontend reliability — shared auto-sync + navigation guard

- **Functional Specification:** `context/spec/010-frontend-reliability/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

Two independent, small fixes — both frontend-only.

**Problem 1 — shared auto-sync:** Add a `tsc --watch` script to `packages/shared/package.json` and chain it in via `concurrently` so every dev-loop entry point (`pnpm dev` at root, `pnpm --filter api dev`, `pnpm --filter web dev`) spins up the shared watcher alongside the main dev process. `concurrently` is a new devDep (~200KB, no transitive weight, standard pnpm-monorepo tool). Production build is unchanged — the existing root `pnpm build` already runs shared before apps via `pnpm --recursive --filter './packages/*' build && --filter './apps/*' build`.

**Problem 2 — navigation guard:** Add a boolean `pendingNavigate` field to `useOnlineGameStore`. Any user action that intentionally initiates an online game sets it to `true`: `joinQueue` in matchmaking, `sendChallenge` + `respondInboundChallenge(accept=true)` in friends. The `AuthenticatedLayout` navigate effect checks this flag before redirecting — if `false`, no navigation fires. The flag is consumed (reset to `false`) on successful navigate, and cleared explicitly when the opt-in action is cancelled (`cancelOutboundChallenge`, matchmaking leave, challenge `declined/expired/cancelled` events).

**No backend changes.** All backend socket contracts, event names, and payloads stay identical.

**Affected files:**
- `packages/shared/package.json` — new `dev` script
- `apps/api/package.json` — `dev` script wrapped with `concurrently`
- `apps/web/package.json` — same
- Root `package.json` — add `concurrently` devDep, update `dev` script to include shared
- `apps/web/src/features/online/useOnlineGameStore.ts` — `pendingNavigate` state + 2 actions
- `apps/web/src/features/online/useMatchmakingStore.ts` — mark pendingNavigate in `joinQueue`, clear in leave
- `apps/web/src/features/friends/useFriendsStore.ts` — mark pendingNavigate in `sendChallenge` + `respondInboundChallenge(true)`, clear in cancel / declined / expired / cancelled listeners
- `apps/web/src/routes.tsx` — `AuthenticatedLayout` navigate effect reads `pendingNavigate`

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Shared package watch loop

**`packages/shared/package.json`:** add

```json
"dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput"
```

Flag notes:
- `--watch`: standard incremental recompile on source change.
- `--preserveWatchOutput`: do NOT clear the terminal between recompiles. Keeps dev-loop output readable when multiplexed with concurrently's prefixes.

**Root `package.json`:** install `concurrently` as a workspace devDep (`pnpm add -D -w concurrently`) and replace the `dev` script:

```json
"dev": "concurrently -k -n shared,web,api -c cyan,magenta,yellow 'pnpm --filter @yanchess/shared dev' 'pnpm --filter web dev' 'pnpm --filter api dev'"
```

- `-k` / `--kill-others`: when one process exits, kill the rest. Ctrl-C stops everything cleanly.
- `-n`: label each output with the subprocess name.
- `-c`: distinct terminal colors per label.

**`apps/api/package.json` → `dev`:**

```json
"dev": "concurrently -k -n shared,api -c cyan,yellow 'pnpm --filter @yanchess/shared dev' 'nest start --watch'"
```

**`apps/web/package.json` → `dev`:**

```json
"dev": "concurrently -k -n shared,web -c cyan,magenta 'pnpm --filter @yanchess/shared dev' 'vite'"
```

**Known tradeoff — duplicate watchers.** If a developer runs `pnpm --filter api dev` and `pnpm --filter web dev` in two shells simultaneously, two independent `tsc --watch` processes write to the same `packages/shared/dist/`. `tsc` writes atomically and both watchers compile the same source, so the output is identical — just wasteful (one extra ~30MB tsc process). Mitigation: nothing. The root `pnpm dev` is the one most developers use; the dual-shell case is rare and not harmful.

**Production build invariant.** The root `"build"` script is already correct — it builds `packages/*` first, then `apps/*`. No change required. CI pipeline runs `pnpm build` unchanged.

### 2.2 Navigation opt-in flag

**`useOnlineGameStore` additions:**

| Field | Type | Initial | Semantics |
|---|---|---|---|
| `pendingNavigate` | `boolean` | `false` | `true` when the current user did an action that should route to `/play` once a game materializes |

Two new actions:
- `markPendingNavigate(): void` → `set({ pendingNavigate: true })`
- `clearPendingNavigate(): void` → `set({ pendingNavigate: false })`

**Call sites that SET `pendingNavigate = true`:**

| File | Action | When |
|---|---|---|
| `useMatchmakingStore.joinQueue` | at start of body, before socket emit | user clicked "Find Game" |
| `useFriendsStore.sendChallenge` | at start of body, before socket emit | user sent an outbound challenge (as challenger) |
| `useFriendsStore.respondInboundChallenge(accept: true)` | only when `accept === true`, before socket emit | user accepted an incoming challenge |

**Call sites that SET `pendingNavigate = false`:**

| File | Trigger | Reason |
|---|---|---|
| `useMatchmakingStore.leaveQueue` (or equivalent cancel action) | user explicitly left the queue | opt-in revoked |
| `useFriendsStore.cancelOutboundChallenge` | user cancelled their outbound challenge | opt-in revoked |
| `useFriendsStore.respondInboundChallenge(accept: false)` | user declined — but they didn't opt in, so this is a no-op in practice. Still include defensively. | hygiene |
| `useFriendsStore` `challenge.declined` socket listener | the OTHER party declined our outbound → opt-in revoked | challenger's opt-in dies with the challenge |
| `useFriendsStore` `challenge.expired` socket listener | 60s timeout — same reasoning | opt-in dies |
| `useFriendsStore` `challenge.cancelled` socket listener | the challenger cancelled theirs (if we were inbound) | opt-in dies |
| `AuthenticatedLayout` navigate effect | immediately after `navigate("/play")` fires successfully | opt-in consumed |

**`AuthenticatedLayout` navigate effect** (`apps/web/src/routes.tsx` line 38-43):

Current:
```tsx
useEffect(() => {
  if (gameId !== null) {
    void navigate("/play");
  }
}, [gameId, navigate]);
```

New:
```tsx
const pendingNavigate = useOnlineGameStore((s) => s.pendingNavigate);
useEffect(() => {
  if (gameId !== null && pendingNavigate) {
    void navigate("/play");
    useOnlineGameStore.getState().clearPendingNavigate();
  }
}, [gameId, pendingNavigate, navigate]);
```

Subscribe both `gameId` and `pendingNavigate` as effect deps so the navigate fires correctly regardless of which transitions first.

### 2.3 Edge cases

- **Browser refresh mid-wait:** user clicked "Find Game", then refreshed the page before match found. On reload, auth session restores, `pendingNavigate` is `false` (store initializes fresh). When `game.start` arrives via socket, no navigation fires. **This is a mild regression from today's behavior** — currently the refresh-and-still-get-navigated case works. Acceptable trade-off per functional-spec §2.2: the opt-in signal lives for the current session, not across reloads. Spec explicitly lists this as "opt-in signal persists for the duration of that queue entry's lifetime" — a queue entry survives a page refresh, so technically it should still navigate. **Decision: for MVP, treat refresh as revoking opt-in.** If users complain, revisit with a session-scoped persistence (sessionStorage).
- **Second game while on `/play`:** user is on `/play` with an active game, somehow a second `game.start` fires (should not happen per backend, but defensive). The effect sees `gameId` transition (same user, same page), `pendingNavigate` may or may not be true. `navigate("/play")` while already on `/play` is a no-op in react-router. Fine.
- **User manually navigates to `/play` while waiting:** they clicked "Find Game", then manually opened `/play` (not from the automatic nav). When game resolves, effect fires, `navigate("/play")` is a no-op. Fine.
- **Challenger accepts own challenge via some race condition:** shouldn't happen per backend (self-challenge rejected with 400). Not addressed.

### 2.4 TypeScript project references (NOT chosen)

Considered using TypeScript project references in `apps/api/tsconfig.json` + `apps/web/tsconfig.json` referencing shared. Rejected because:
- Vite does not use `tsc --build` to resolve references — it uses esbuild/rollup and respects package.json `"module"` field directly, which already points at `src/index.ts`. Vite dev already sees shared's TypeScript source.
- SWC used in NestJS doesn't follow project references either; it runs on sourceRoot only. The actual Node runtime loads from `dist/`.
- Project references help `tsc --build` orchestration, not the runtime module resolution that bites us today.
- `concurrently + tsc --watch` is the direct fix for the runtime problem.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Zustand store shape change** on `useOnlineGameStore` — one new field + two actions. Existing tests that mock the store need to be updated if they do exhaustive shape assertions. Expected impact: 1-2 unit test files touched to include `pendingNavigate: false` in their default state.
- **Dev-script change** affects local dev workflow only. CI pipeline + production build unchanged.
- **No backend changes.** Specs 004 socket events, spec 007 challenge events — all identical.

### 3.2 Potential Risks & Mitigations

- **`concurrently` adds a devDep.** Risk: supply-chain surface. Mitigation: `concurrently` is a widely-used, well-maintained package (6M weekly downloads, active since 2015). Pin to `^9.x`.
- **Duplicate `tsc --watch` processes.** Risk: wasted CPU + memory when running both `pnpm --filter api dev` and `pnpm --filter web dev` in parallel. Mitigation: documented in §2.1; prefer root `pnpm dev`.
- **Opt-in flag false negatives.** If a code path intentionally starts an online game but forgets to set `pendingNavigate`, the user won't be auto-navigated. Mitigation: FTR tests cover both matchmaking + challenge accept flows explicitly. New call sites that start games must set the flag — add a lint-level comment or extract a helper (optional).
- **Opt-in flag false positives.** If `pendingNavigate = true` is set but no game materializes within a reasonable window, the flag stays set forever (until cleared). Later, if a NEW game starts (via a different flow or stale socket), the user would be navigated. Mitigation: every cancellation path clears the flag. Also: if `useOnlineGameStore` has a reset action (e.g., on game end), include `pendingNavigate: false` in the reset.
- **Browser refresh loses opt-in.** Known tradeoff per §2.3. If this becomes a user complaint, migrate flag to `sessionStorage`-backed Zustand persist middleware.

### 3.3 Deployment / Runtime impact

- Local dev: `pnpm install` installs `concurrently`. Developers restart their dev-loop after the install.
- Production build: zero impact. Server/CDN output identical.
- Rollback: revert the package.json scripts + route effect; store field becomes unused but inert.

---

## 4. Testing Strategy

### 4.1 Unit tests

**`apps/web/src/features/online/useOnlineGameStore.spec.ts`** (likely exists; extend):
- `markPendingNavigate` → `pendingNavigate = true`.
- `clearPendingNavigate` → `pendingNavigate = false`.
- Default state has `pendingNavigate: false`.

**`apps/web/src/features/online/useMatchmakingStore.spec.ts`** (likely exists):
- `joinQueue` sets `useOnlineGameStore.pendingNavigate = true`.
- `leaveQueue` (or cancel) sets it back to `false`.

**`apps/web/src/features/friends/useFriendsStore.spec.ts`** (likely exists):
- `sendChallenge` sets `pendingNavigate = true`.
- `respondInboundChallenge(true)` sets it true.
- `respondInboundChallenge(false)` leaves it false (or forcibly false).
- `cancelOutboundChallenge` clears it.
- Socket listeners for `challenge.declined/expired/cancelled` clear it.

### 4.2 Integration tests

**`apps/web/src/routes.spec.tsx`** or similar:
- `AuthenticatedLayout` effect: given `gameId = "x"` + `pendingNavigate = true` → `navigate("/play")` called once + `clearPendingNavigate` called.
- Given `gameId = "x"` + `pendingNavigate = false` → `navigate` NOT called.
- Given `gameId = null` → `navigate` NOT called regardless of flag.

### 4.3 FTR (Slice 3)

Combined scenarios covering functional-spec §2.1 (dev-loop auto-sync) and §2.2 (navigation guard) via Playwright MCP for the UI side + manual edit test for the shared-package side.

### 4.4 Regression check

- All 89 unit + 76 e2e + 252 web tests remain green.
- Specs 001-009 behavior unaffected — backend untouched; UI opt-in flag defaults to `false` in all legacy test setups so matchmaking + challenge happy paths that explicitly call the opt-in continue to work. Explicitly test spec 004 matchmaking happy path + spec 007 challenge-accept happy path land on `/play` after the refactor.
