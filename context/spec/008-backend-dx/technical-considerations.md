# Technical Specification: Backend developer experience — build pipeline + DI untangle

- **Functional Specification:** `context/spec/008-backend-dx/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

Two independent refactors in one spec, both backend-only, both touching infra not features.

**Problem 1 — build pipeline:** `nest build` and `nest start --watch` are present in `apps/api/package.json` scripts, but `nest start --watch` is broken by a race between NestJS CLI's `deleteOutDir: true` and the `tsc` builder: NestJS clears `dist/`, starts `tsc --watch`, and tries to `node dist/main.js` before `tsc` finishes writing files on first compile. The fix is to switch NestJS CLI to the SWC builder (`@swc/core` is already a devDependency) — SWC compiles synchronously in-process, which both eliminates the race and gives us 10× faster incremental builds. No behavior change at runtime.

**Problem 2 — DI graph:** 16 `forwardRef` occurrences form a cluster spanning Friends, Game, Matchmaking modules + `FlagSweepWorker`. The root cause is a pattern: services inject gateway *classes* so they can call `.getServer().to(room).emit(...)`. That makes services depend on gateways, and gateways depend on other services → every pair has a back-edge.

The fix is a single thin `RealtimeModule` that owns a `RealtimeEmitter` (socket emission facade) and `PresenceService` (presence facade). Gateways register their `Server` instance with the emitter on `afterInit` once; nothing else injects a gateway. Services inject only `RealtimeEmitter` + `PresenceService`, both one-way dependencies on the new leaf module. The dependency graph becomes a DAG.

**No new npm dependencies.** `@swc/core` + `@swc/cli` are already installed.

**No behavioral change.** All socket namespaces, event names, payloads, REST responses, and navigation stay byte-identical. The refactor is invisible to the frontend and to the FTR test suite (74 e2e tests from spec 007 verify this).

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Build pipeline — switch to SWC builder

**Edit `apps/api/nest-cli.json`:**

```jsonc
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "swc",
    "typeCheck": true,
    "deleteOutDir": true,
    "assets": [],
    "watchAssets": false
  }
}
```

Key additions:
- `"builder": "swc"` — NestJS CLI uses SWC instead of tsc. Known-good for NestJS 10 + decorators.
- `"typeCheck": true` — SWC skips type checking by design; this flag runs `tsc --noEmit` in parallel so compile errors still surface. (`pnpm --filter api typecheck` script remains the authoritative check — this is just a dev-loop convenience.)

**No code changes to `.ts` files required** — SWC consumes the same `tsconfig.json`.

**Verify SWC emits NestJS decorators correctly:**

NestJS 10 + SWC is a documented combination (https://docs.nestjs.com/recipes/swc). The emitter must preserve `emitDecoratorMetadata` for DI reflection. SWC does this automatically when the tsconfig has `"emitDecoratorMetadata": true` (currently set in `apps/api/tsconfig.json` — verify in Slice 1 as a precondition).

**Risk:** some NestJS tests use `reflect-metadata` indirectly via `@nestjs/testing`. SWC's metadata emission may differ subtly from tsc. Mitigation: run full unit + e2e suite before merging. Rollback plan: revert `nest-cli.json` to the current state; the issue falls back to the manual `pnpm exec tsc -p tsconfig.json --outDir dist` workaround which still works.

**Add a `.swcrc` only if default behavior is wrong.** First-pass tries empty `.swcrc` (SWC inherits sensible defaults from `tsconfig.json`).

### 2.2 DI graph — introduce `RealtimeModule`

**New module location:** `apps/api/src/modules/realtime/`

Files:

| File | Role |
|---|---|
| `realtime.module.ts` | `@Module({ providers: [RealtimeEmitter, PresenceService], exports: [RealtimeEmitter, PresenceService] })`. Imports `PrismaModule`. **Imports nothing from Friends/Game/Matchmaking.** |
| `realtime-emitter.ts` | Thin service holding `Map<string, Server>` keyed by namespace. Public API: `register(namespace: string, server: Server): void`, `toRoom(namespace: string, room: string): BroadcastOperator`, `toUser(userId: string, namespace?: string): BroadcastOperator`, `socketCount(userId: string): Promise<number>` (sums across all registered namespaces). |
| `presence.service.ts` | Moved from `modules/friends/`. Depends only on `PrismaService` + `RealtimeEmitter`. No gateway reference. Public API unchanged: `getSocketCount`, `broadcastPresence`. |

**Gateways' `afterInit` hook registers with the emitter:**

```ts
// game.gateway.ts (sketch — not full code)
@WebSocketGateway({ namespace: '/play', ... })
export class GameGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;
  constructor(private readonly realtime: RealtimeEmitter, ...) {}
  afterInit() {
    this.realtime.register('play', this.server);
  }
}
```

Same shape for `FriendsGateway` registering namespace `'friends'`.

**Service refactor — call sites change from `gateway.getServer().to(...).emit(...)` to `realtime.toRoom(ns, room).emit(...)`:**

| Caller | Old | New |
|---|---|---|
| `GameService.endGame` | `this.gameGateway.getServer().to('game:'+id).emit('game.end', ...)` | `this.realtime.toRoom('play', 'game:'+id).emit('game.end', ...)` |
| `MatchmakingService.pairPlayers` | `this.gameGateway.getServer().to('game:'+id).emit('game.start', ...)` | `this.realtime.toRoom('play', 'game:'+id).emit('game.start', ...)` |
| `FriendsService.sendRequest` | `this.friendsGateway.getServer().to('user:'+id).emit('friend.requested', ...)` | `this.realtime.toUser(id, 'friends').emit('friend.requested', ...)` |
| `PresenceService.broadcastPresence` | mixed gateway calls | single-namespace `this.realtime.toUser(friendId, 'friends').emit(...)` |
| `ChallengeService.resolveAccept` | multiple gateway hops | `this.realtime.toRoom('play', 'game:'+id).emit('game.start', ...)` + `this.realtime.toUser(...).emit('challenge.cancelled', ...)` |
| `ChallengeExpirySweeper` | `this.friendsGateway.getServer().to(...)` | `this.realtime.toUser(id, 'friends').emit('challenge.expired', ...)` |
| `FlagSweepWorker` | `this.gameService.endGameByFlag(...)` (unchanged — service-to-service, not gateway) | same |

**Dependency changes per file:**

| File | Removes | Adds |
|---|---|---|
| `game.gateway.ts` | `forwardRef(MatchmakingService)`, `forwardRef(GameService)`, `forwardRef(PresenceService)` | `RealtimeEmitter` (one-way) |
| `game.service.ts` | `forwardRef(GameGateway)` | `RealtimeEmitter` (one-way) |
| `matchmaking.service.ts` | `forwardRef(GameGateway)`, `forwardRef(GameService)` | `RealtimeEmitter` (one-way), `GameService` (one-way, no forwardRef) |
| `friends.gateway.ts` | `forwardRef(PresenceService)`, `forwardRef(ChallengeService)` | `RealtimeEmitter` (one-way), `ChallengeService` (one-way, no forwardRef) |
| `friends.service.ts` | `forwardRef(FriendsGateway)`, `forwardRef(PresenceService)` | `RealtimeEmitter` + `PresenceService` (both one-way) |
| `challenge.service.ts` | 5× `forwardRef(...)` | `RealtimeEmitter`, `PresenceService`, `FriendsService`, `GameService` (all one-way) |
| `presence.service.ts` (moved to realtime/) | `forwardRef(FriendsGateway)`, `forwardRef(GameGateway)` | `RealtimeEmitter` (one-way) |
| `challenge-expiry.sweeper.ts` | `forwardRef(FriendsGateway)` | `RealtimeEmitter` (one-way) |
| `flag-sweep.worker.ts` | `forwardRef(GameService)` | `GameService` (one-way; GameService no longer depends on gateway so no cycle) |
| `game.module.ts` | `forwardRef(MatchmakingModule)`, `forwardRef(FriendsModule)` | imports `RealtimeModule` only |
| `friends.module.ts` | `forwardRef(GameModule)` | imports `RealtimeModule` only |
| `matchmaking.module.ts` | `forwardRef(GameModule)` | imports `GameModule` (regular), `RealtimeModule` |

After the refactor, `grep -rn "forwardRef" apps/api/src/modules/` should return **zero** results.

**Dependency arrows post-refactor:**

```
RealtimeModule (leaf: Prisma)
  ← FriendsModule (RealtimeModule, Prisma)
  ← GameModule (RealtimeModule, Prisma, Redis)
  ← MatchmakingModule (GameModule, RealtimeModule, Redis)
AppModule → all of the above
```

No cycles.

### 2.3 Documentation note — "how to add a feature module"

Add a short section (~30 lines) to `context/product/architecture.md` under a new `## 8. Backend module patterns` heading. Contents:

- "Services never inject gateways. Gateways never inject services from other feature modules."
- "To emit a socket event or check presence, inject `RealtimeEmitter` or `PresenceService` from `RealtimeModule`."
- "Minimal example: a `MyFeatureService` that emits `my.event` to a user's `friends` room — one `@Inject(RealtimeEmitter)`, no `forwardRef`."
- "If you find yourself writing `forwardRef`, stop and ask: who should actually own this emission?"

**Rationale for architecture.md vs CLAUDE.md:** architecture.md is already the canonical doc for backend patterns (§1-7 cover stack, data, infra, external services, security, rating, open decisions). CLAUDE.md is more about agent instructions; this is a code-review-level rule, so it belongs with the architecture.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Specs 001-007 feature tests (74 e2e, 59 unit)** — must all pass after the refactor with identical counts. This is the primary regression signal.
- **Prisma `Friendship` model, Redis `user:activeGame:*` + `user:activeChallenge:*` keys** — unchanged; no data layer impact.
- **Socket.IO namespaces (`/play`, `/friends`) + event names + payloads** — unchanged. Frontend untouched.
- **Auth stack (JWT, guards)** — unchanged.
- **Dev-API process management** — the running dev-API on port 3000 (started via `node dist/main.js`) must survive the refactor without a forced restart during implementation; verify tasks will restart it as needed.

### 3.2 Potential Risks & Mitigations

- **SWC decorator metadata subtly differs from tsc.** Known-good for NestJS 10 but still worth a sanity check. Mitigation: run `pnpm --filter api test:unit` + `pnpm --filter api test:e2e` after the SWC switch. If any test fails due to DI resolution, add a minimal `.swcrc` with explicit `transform.decoratorMetadata: true`. Rollback: revert nest-cli.json; manual tsc path still works.
- **`RealtimeEmitter.register` timing — late binding.** Gateways call `register()` in `afterInit`, which fires AFTER module providers are instantiated but BEFORE Nest signals "application started". So any emit called during module construction would see an empty map. Risk is low (no current call-site emits during construction) but mitigate by having `toRoom`/`toUser` throw if the namespace is not yet registered; this surfaces timing bugs loudly instead of silently dropping events.
- **`PresenceService` move changes its import path.** All existing imports `from '../friends/presence.service'` must update to `from '../realtime/presence.service'`. Simple find-replace; typecheck catches any miss.
- **`broadcastPresence` currently queries both namespaces' sockets individually.** New implementation sums via `RealtimeEmitter.socketCount(userId)` which iterates all registered namespaces. Semantics preserved; a single new feature later only needs to `register('new-namespace', ...)` and presence auto-includes it.
- **Behavioral drift during refactor.** Mitigation: the Slice 7 end-to-end FTR test suite (74 e2e in `apps/api/test/e2e/13-friends.spec.ts` plus specs 001-006 e2e) is the regression net. Any socket payload / event drift fails those tests.
- **Hot-reload under SWC may not pick up `.ts` file renames or new files immediately.** Known SWC behavior. Mitigation: restart the dev-loop manually when adding new files, document the quirk in architecture.md.
- **Project-level `pnpm dev` fans out to all apps in parallel; a broken `nest start --watch` could cascade.** Mitigation: validate `pnpm --filter api dev` in isolation before trusting the workspace-level command.

### 3.3 Deployment / Runtime impact

- No new runtime dependencies.
- No DB migrations.
- No Redis key changes.
- Local dev-API restart required once at end of refactor to pick up the new module graph; verify tasks handle this.

---

## 4. Testing Strategy

### 4.1 Narrow validation per slice

- `pnpm --filter api typecheck` — must pass after every slice.
- `pnpm --filter api test:unit` — must pass; count may differ if a test specific to the old DI shape is deleted (e.g., a mock of `FriendsGateway.getServer()` becomes a mock of `RealtimeEmitter.toRoom()`).

### 4.2 Full regression (end of refactor)

- `pnpm --filter api test:unit` — ≥ 59 tests pass (count may rise if we add 1-2 tests for `RealtimeEmitter.register` timing).
- `pnpm --filter api test:e2e` — ≥ 74 tests pass. These exercise socket emission end-to-end and are the authoritative regression net.
- `pnpm --filter web typecheck` + `pnpm --filter web test -- --run` — 252 tests pass (unchanged; refactor is backend-only).

### 4.3 Live smoke (Verify tasks via Playwright MCP)

- Spec 004 — matchmaking 2 users → `game.start` lands on both.
- Spec 007 — challenge → accept → `game.start` lands on both.
- Spec 007 — friend request live update → `friend.requested` appears without refresh.
- Spec 007 — presence flip online/offline → dot updates within 2s.

### 4.4 Build-pipeline-specific tests

- `pnpm --filter api build` from clean state → produces `dist/main.js`; `node dist/main.js` boots the API with all modules initialized.
- `pnpm --filter api dev` → API listening + file-watching message within 10 seconds; a 1-char edit in any `apps/api/src/` file triggers reload within 2 seconds.
- Syntax-error smoke: introduce `const x = ;` into a source file → terminal shows the error, watch process survives, fixing the error restarts the reload.
