# Technical Specification: Matchmaking and online game

- **Functional Specification:** `context/spec/004-matchmaking-and-online-game/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

Introducing Socket.IO as the first real-time transport in the project. On the backend — a new NestJS gateway `/play` with two logical areas (matchmaking and game), a shared JWT-aware WS guard, a Redis sorted-set for the rating queue, and a Redis hash for the active game (source of truth for position and clocks). On the frontend — a single protected page `/play` with internal phases (idle → searching → playing → result), two new Zustand stores (matchmaking and online game) and a singleton Socket.IO client. Chess rules move to the server (chess.js) — the client keeps optimistic rendering, but the truth lives on the server. Rating is recalculated with the classical ELO formula (K=32 for the first 30 games, K=16 afterwards) in a single transaction with the `Game` row written to Postgres. The `rd`/`volatility` fields on `RatingByMode` are kept (for a future migration to Glicko-2).

Reusable components (`Board`, `Clock`, `MoveHistory`, dialogs, `ResultModal`) are refactored to a prop-based `GameViewModel` — the same markup is fed from two sources (hotseat → `useGameStore`; online → `useOnlineGameStore`).

**Affected systems:** API (new modules game/matchmaking/rating + Socket.IO), Postgres (new table `games` + enums), Redis (new key namespaces `mm:*`, `game:*`, `user:activeGame:*`), web client (new page `/play`, new stores, refactoring of game components to be prop-driven), shared package (new types: `GameColor`, `GameResult`, `GameEndReason`, socket event payloads).

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Architecture Changes

- **Socket.IO as the first real-time transport.** On the backend — a single namespace `/play` for both use cases (matchmaking and game). Rationale: one socket, one handshake, one reconnect cycle; separate gateways would be pure overhead complexity for the client.
- **Horizontal-scaling-ready with zero refactoring.** We plug in `@socket.io/redis-adapter` on top of the existing ioredis. On a single-instance deployment it is a no-op; on scale-out events are automatically forwarded via Redis pub/sub.
- **Server-authoritative state model.** The active game lives in the Redis hash `game:{gameId}` (FEN, clocks, list of SAN moves, side to move). We write to Postgres only on game end (one transaction — `Game` + both `RatingByMode`).
- **Shared JWT verification.** Token verification + `pwdEpoch` logic is extracted from `JwtAuthGuard` into `TokenVerifierService` — the new `WsJwtGuard` reuses it without duplication.
- **chess.js on the server.** A new `chess.js@1` dependency in `apps/api/package.json`. `packages/shared` stays untouched — the client has its own copy; a server-side module cannot import it directly (different binaries).

### 2.2 Data Model / Database Changes

**New Prisma model `Game`** (`apps/api/prisma/schema.prisma`):

| Field | Type | Purpose |
|---|---|---|
| `id` | `uuid`, pk | game identifier |
| `mode` | `Mode` (existing enum) | mode (Bullet/Blitz/Rapid/Classical) |
| `timeControlMs` | `int` | initial time for each side (60_000 / 180_000 / 600_000 / 1_800_000) |
| `whiteUserId` | `uuid`, FK → `User` | white player |
| `blackUserId` | `uuid`, FK → `User` | black player |
| `result` | enum `GameResult` (`white_win` / `black_win` / `draw`) | outcome |
| `endReason` | enum `GameEndReason` (`checkmate`, `resignation`, `flag`, `flag_vs_insufficient_material`, `stalemate`, `insufficient_material`, `threefold_repetition`, `fifty_move`, `agreement`) | reason for ending |
| `pgn` | `text` | full PGN (headers + moves) |
| `finalFen` | `text` | final FEN (for a history list later) |
| `whiteRatingBefore` / `whiteRatingAfter` | `int` / `int` | snapshot of white's rating before/after — for display without recomputation |
| `blackRatingBefore` / `blackRatingAfter` | `int` / `int` | same for black |
| `startedAt` / `endedAt` | `timestamptz(3)` / `timestamptz(3)` | timestamps |

**Indexes:** `(whiteUserId, startedAt desc)`, `(blackUserId, startedAt desc)` — for a future "my game history".

**Back-relations on `User`:** `gamesAsWhite Game[] @relation("WhiteGames")`, `gamesAsBlack Game[] @relation("BlackGames")`.

**Migration:** `apps/api/prisma/migrations/<timestamp>_add_game/` — adds enums `GameResult`, `GameEndReason`, the `games` table and two compound indexes.

**Deferred:** `game_moves` table (one row per half-move with SAN/clock) — moved to a future "game history / replay" spec. For 004 PGN-only is sufficient: rating recalculation only reads the result, the result screen receives deltas from the transaction, and PGN parsing for replay is the job of future code.

**`RatingByMode` is unchanged** — the existing `rd`/`volatility` fields stay (for a future Glicko-2); ELO only touches `rating` and `gamesPlayed`.

### 2.3 Redis Structures

| Key | Type | Purpose | TTL |
|---|---|---|---|
| `mm:queue:{mode}` | sorted set | member = `userId`, score = `rating`. `ZRANGEBYSCORE` for searching within ±delta. | none (removed on cancel/match/disconnect) |
| `mm:entry:{userId}` | hash | `{ mode, rating, joinedAt, socketId, deltaStep }` — what is in the queue, when joined, the current widening step. The pairing worker reads it. | 300 s (safety net) |
| `mm:users:searching` | set | dedupe: `SADD` before enqueue, `SREM` on exit; guards against a duplicate from a second tab. | none |
| `game:{gameId}` | hash | `fen`, `whiteClockMs`, `blackClockMs`, `lastMoveAt` (ms epoch when clocks switched), `sideToMove`, `whiteUserId`, `blackUserId`, `mode`, `timeControlMs`, `status` (`active` / `ended`), `drawOfferFrom`, `whiteDrawOfferLastMoveNumber`, `blackDrawOfferLastMoveNumber` | none while `active`; `EXPIRE 3600` after `ended` |
| `game:{gameId}:moves` | list | `RPUSH` a SAN move on each applied move | same as the hash |
| `user:activeGame:{userId}` | string | `gameId` of the player's current active game — for fast hydration on reconnect | same as the hash |
| `game:active` | set | all active `gameId`s — for the flag-sweep worker | none (SREM on game end) |
| `rematch:offer:{gameId}` | string | userId of the rematch offerer | 30 s (response window) |

**Flag-check:** the sweep worker runs every ~1 s, walks `SMEMBERS game:active`, reads `whiteClockMs`/`blackClockMs`/`lastMoveAt`/`sideToMove`, subtracts `now - lastMoveAt` from `sideToMove`, and if ≤ 0 ends the game (`flag` or `flag_vs_insufficient_material`). Choice of sweep over keyspace notifications: no need to enable `notify-keyspace-events` globally, easier to test.

### 2.4 Backend Modules & API Contracts

All new modules under `apps/api/src/modules/`.

**`game/`**

| File | Responsibility |
|---|---|
| `game.gateway.ts` | `@WebSocketGateway({ namespace: 'play' })`; all `game.*` events; delegates to `GameService`; broadcasts into the `game:{gameId}` room |
| `game.service.ts` | Game lifecycle: `createGame`, `applyMove`, `resign`, `offerDraw`, `respondDraw`, `offerRematch`, `respondRematch`, `endGame`; checks turn order, calls `ChessRulesService`, persists via `GameRepository` |
| `game.repository.ts` | All Prisma calls for `Game` in one place; `GameService` doesn't talk to Prisma directly |
| `chess-rules.service.ts` | A wrapper over `chess.js` on the server. Stateless: `applyMove(fen, { from, to, promotion })` → `{ fen, san, over? }` or rejection. FEN is the single source of truth; a `Chess()` instance doesn't live between calls |
| `clock.service.ts` | Server clocks: on each move `elapsed = now - lastMoveAt`, subtracts from `sideToMove`, snaps into Redis, schedules flag-check |
| `flag-sweep.worker.ts` | `@Interval(1000)` — walks `game:active`, detects a flag fall without an incoming move |
| `game.module.ts` | imports: `PrismaModule`, `RedisModule`, `AuthModule` (for `TokenVerifierService`), `RatingModule` |

**`matchmaking/`**

| File | Responsibility |
|---|---|
| `matchmaking.service.ts` | `joinQueue(userId, rating, mode)`, `leaveQueue(userId)`, `runPairingCycle()`. The pairing worker — `@Interval(1000)` inside the service itself |
| `matchmaking.module.ts` | imports: `RedisModule`, `GameModule` (for `GameService.createGame`) |

**`rating/`**

| File | Responsibility |
|---|---|
| `rating.service.ts` | `applyGameResult(whiteUserId, blackUserId, mode, result)` → `{ whiteDelta, blackDelta, whiteRatingAfter, blackRatingAfter }`. ELO formula (below) |
| `rating.module.ts` | imports: `PrismaModule` |

**Shared**

| File | Responsibility |
|---|---|
| `auth/token-verifier.service.ts` | Extracted from `JwtAuthGuard`: `verifyAccessToken(raw) → payload` with the `pwdEpoch` check. Injected into `JwtAuthGuard` (HTTP) and `WsJwtGuard` (WS) |
| `auth/ws-jwt.guard.ts` | `CanActivate` for WS; reads `client.handshake.auth.token`, calls `TokenVerifierService`, writes `client.data.userId` and `client.data.nickname` |

**Dependencies (`apps/api/package.json`):** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@socket.io/redis-adapter`, `chess.js@1`.

**Socket.IO events (namespace `/play`):**

Client → Server:

| Event | Payload |
|---|---|
| `hello` | `{}` (server responds with `game.snapshot` / `queue.joined` / silence — determines the user's current state) |
| `queue.join` | `{ mode }` |
| `queue.leave` | `{}` |
| `game.move` | `{ gameId, from, to, promotion? }` |
| `game.resign` | `{ gameId }` |
| `game.offerDraw` | `{ gameId }` |
| `game.respondDraw` | `{ gameId, accept }` |
| `game.offerRematch` | `{ gameId }` |
| `game.respondRematch` | `{ gameId, accept }` |

Server → Client:

| Event | Where | Payload |
|---|---|---|
| `queue.joined` | `user:{userId}` | `{ mode, since }` |
| `queue.left` | `user:{userId}` | `{}` |
| `game.start` | `user:{whiteId}` + `user:{blackId}` | `{ gameId, color, opponent: { nickname, rating }, mode, timeControlMs, fen, clocks, sideToMove, serverNow }` |
| `game.state` | `game:{gameId}` | `{ gameId, fen, lastMove: { from, to }, san, clocks, sideToMove, moveNumber, serverNow }` |
| `game.snapshot` | `user:{userId}` | same as `game.state` + `color` + `opponent` (hydration after reconnect) |
| `game.moveRejected` | specific socket | `{ gameId, reason }` |
| `game.drawOffered` | `game:{gameId}` | `{ gameId, byColor }` |
| `game.drawDeclined` | `game:{gameId}` | `{ gameId }` |
| `game.rematchOffered` | `user:{opponentId}` | `{ previousGameId, byUserId }` |
| `game.opponentOnline` | `game:{gameId}` | `{ gameId, color, online }` |
| `game.end` | `game:{gameId}` | `{ gameId, result, endReason, pgn, finalFen, ratingDeltas: { white, black }, ratingsAfter: { white, black } }` |

**Auth on the socket:** the client passes JWT in the handshake `auth.token`; `WsJwtGuard` (global on the gateway) verifies it, writes `userId`/`nickname` into `client.data`, otherwise — `WsException('UNAUTHORIZED')`. The exception filter turns the error into `{ error: { code, message } }` and does not drop the connection.

**Rooms:** on `connection` the socket auto-joins `user:{userId}`. On `game.start` both sockets (of all tabs for both players) join `game:{gameId}`. This is the tab-sync mechanism: broadcasting into `game:{gameId}` reaches all open windows on both sides.

### 2.5 Logic / Algorithm

#### 2.5.1 Pairing worker

```
every 1s, for each mode in [Bullet, Blitz, Rapid, Classical]:
  candidates = ZRANGE mm:queue:{mode} 0 -1 WITHSCORES
  for each (userId, rating) in candidates:
    entry = HGETALL mm:entry:{userId}
    waitSec = (now - entry.joinedAt) / 1000
    delta = 100 * 2 ^ floor(waitSec / 10)   # 100 → 200 → 400 → 800 → …
    eligible = ZRANGEBYSCORE mm:queue:{mode} (rating-delta) (rating+delta)
               excluding userId itself
    if eligible is empty: continue
    opponent = argmin |opponent.rating - rating|   # nearest-rating, not FIFO

    # atomic removal via Lua / MULTI:
    SREM mm:users:searching userId opponentId
    ZREM mm:queue:{mode} userId opponentId
    DEL  mm:entry:{userId} mm:entry:{opponentId}

    randomColor = Math.random() < 0.5 ? "white" : "black"
    whiteId, blackId = assign by randomColor
    gameId = GameService.createGame(whiteId, blackId, mode)
    emit("game.start", ...) to user:{whiteId} and user:{blackId}
    break   # rescan from scratch — to avoid double pairing
```

A Lua script for atomic SREM+ZREM+DEL is important for future scale-out (two instances might simultaneously pair the same user). For single-instance `MULTI/EXEC` is equivalent.

#### 2.5.2 Authoritative clock

On each accepted move:

1. `elapsed = Date.now() - lastMoveAt`
2. Subtract `elapsed` from `sideToMove`'s clock.
3. If the clock ≤ 0 — flag inline (determined right there in `GameService.applyMove`): check the opponent's material sufficiency via chess.js (`chess.insufficient_material()`); result — `flag` or `flag_vs_insufficient_material`.
4. Apply the move via `ChessRulesService`, get new `fen`, SAN, over-flags.
5. `HSET game:{id} fen=... whiteClockMs=... blackClockMs=... lastMoveAt=now sideToMove=opposite`
6. `RPUSH game:{id}:moves san`
7. Broadcast `game.state` with `serverNow = now`.

The client ticks locally: the displayed time of the active side = `clocks[active] - (Date.now() - lastSyncClientMs)`, where `lastSyncClientMs = Date.now()` at the moment of receiving the latest push. This gives a smooth tick without drift accumulation — every push snaps the clocks to the server truth.

#### 2.5.3 Flag detection without an incoming move

The flag-sweep worker — `@Interval(1000)` — walks `SMEMBERS game:active`, reads the hash, computes the remaining clock of `sideToMove`; if ≤ 0 it calls `GameService.endGame(id, 'flag' | 'flag_vs_insufficient_material')`. The same behaviour as inline in 2.5.2 — one exit point.

#### 2.5.4 ELO rating calculation

`RatingService.applyGameResult(whiteUserId, blackUserId, mode, result)`:

```
Rw, Rb = current ratings
expectedW = 1 / (1 + 10 ^ ((Rb - Rw) / 400))
expectedB = 1 - expectedW
Kw = white.gamesPlayed < 30 ? 32 : 16
Kb = black.gamesPlayed < 30 ? 32 : 16
scoreW = result === "white_win" ? 1 : result === "draw" ? 0.5 : 0
newRw = round(Rw + Kw * (scoreW - expectedW))
newRb = round(Rb + Kb * ((1 - scoreW) - expectedB))
```

Write — a single `prisma.$transaction([...])`:

1. `game.create` with `whiteRatingBefore=Rw`, `whiteRatingAfter=newRw`, `blackRatingBefore=Rb`, `blackRatingAfter=newRb`, `pgn`, `finalFen`, `result`, `endReason`, `startedAt`, `endedAt`.
2. `ratingByMode.update` (white): `rating = newRw`, `gamesPlayed: { increment: 1 }`.
3. `ratingByMode.update` (black): `rating = newRb`, `gamesPlayed: { increment: 1 }`.

On any error — rollback, the game stays alive in Redis (retry at the `GameService.endGame` level).

Asymmetric K (white <30 games, black ≥30 — or vice versa) is acceptable: deltas will differ between players, which fits the specification (visible deltas are honest for each).

#### 2.5.5 Game end sequence

On `GameService.endGame`:

1. `ChessRulesService` / clock / resign / draw-accept — determines `result` + `endReason`.
2. Assemble the PGN from `game:{id}:moves` (RPUSH-ed SAN) + headers (white, black, date, mode, result).
3. `RatingService.applyGameResult` — returns `{ whiteDelta, blackDelta, ... }`.
4. `prisma.$transaction` (step 2.5.4) — atomically writes `Game` + both `RatingByMode`.
5. `HSET game:{id} status=ended`; `EXPIRE game:{id} 3600`; `EXPIRE game:{id}:moves 3600`; `EXPIRE user:activeGame:{whiteId}/{blackId} 3600`; `SREM game:active {id}`.
6. Emit `game.end` into the `game:{gameId}` room with `ratingDeltas` and `ratingsAfter`.

#### 2.5.6 Rematch

On `game.offerRematch { gameId }`: `SET rematch:offer:{gameId} userId EX 30`. Emit `game.rematchOffered` into `user:{opponentId}`.

On `game.respondRematch { gameId, accept: true }`:
- Check `GET rematch:offer:{gameId}` → if still alive and userId is the responder — no pairing needed, immediately `GameService.createGame(oldBlackId, oldWhiteId, mode)` (colors swap) → `game.start` to both.
- `DEL rematch:offer:{gameId}`.

On `game.respondRematch { accept: false }` or TTL: `DEL`, the initiator sees "Opponent didn't respond".

### 2.6 Frontend

#### 2.6.1 Routes & pages

- `apps/web/src/routes.tsx` — add `/play`, protected (the `RequireAuth` guard redirects to `/login?returnTo=/`).
- `apps/web/src/pages/Play.tsx` — a single page, 4 internal phases (`idle` / `searching` / `playing` / `result`). The URL does not change.
- `apps/web/src/pages/Home.tsx` — replace the placeholder "Find game → /profile" with `PlayOnlineBlock`: 4 mode cards (default — `Blitz`), the current rating next to the button, click → `navigate("/play", { state: { mode } })`.
- `apps/web/src/pages/Login.tsx` — read `location.state.message` + `location.state.returnTo` to show "Sign in to play online" and return after sign-in.

#### 2.6.2 Zustand stores + Socket.IO client

**`apps/web/src/features/online/socket.ts`** — singleton. `getSocket(): Socket<ServerToClientEvents, ClientToServerEvents>` lazily creates `io('<VITE_API_URL>/play', { auth: { token }, transports: ['websocket'] })`. The token is read from `useAuthStore.getState().accessToken` at call time. On a 401/`UNAUTHORIZED` error — call the same refresh path from `apiClient.ts` and re-auth the socket.

**`useMatchmakingStore` (`features/online/useMatchmakingStore.ts`)**

```ts
interface MatchmakingState {
  phase: 'idle' | 'searching' | 'found';
  mode: Mode | null;
  since: number | null;  // Date.now() of the moment of entering the queue
  joinQueue(mode: Mode): void;
  leaveQueue(): void;
}
```

Elapsed timer in the search UI — a separate `useQueueTimer` hook on rAF (same as `useGameClock` in hotseat).

**`useOnlineGameStore` (`features/online/useOnlineGameStore.ts`)**

```ts
interface OnlineGameState {
  gameId: string | null;
  fen: string;
  movesSan: string[];
  clocks: { whiteMs: number; blackMs: number };
  serverNow: number;
  lastSyncClientMs: number;
  sideToMove: GameColor;
  color: GameColor | null;
  opponent: { nickname: string; rating: number; online: boolean } | null;
  pendingPromotion: { from: string; to: string } | null;
  pendingDrawOffer: { from: GameColor } | null;
  myLastDrawOfferMoveNumber: number | null;
  result: GameResult | null;
  endReason: GameEndReason | null;
  ratingDelta: number | null;
  ratingsAfter: { white: number; black: number } | null;
  pendingRematch: { from: 'me' | 'opponent'; expiresAt: number } | null;
  // actions
  makeMove(from, to, promotion?): void;
  resign(): void;
  offerDraw(): void;
  respondDraw(accept: boolean): void;
  offerRematch(): void;
  respondRematch(accept: boolean): void;
}
```

Clock rendering: the `useOnlineGameClock` hook on rAF computes `storedMs - (Date.now() - lastSyncClientMs)` for `sideToMove`. On each `game.state` push, we snap the clocks to the server values.

Optimistic move: a local `Chess()` instance for highlights and instant rendering. On `game.moveRejected` — roll back to the FEN of the last `game.state`.

#### 2.6.3 Component reuse

Refactor hotseat components to a prop-driven `GameViewModel` (`features/shared/game-view-model.ts`):

```ts
interface GameViewModel {
  fen: string;
  movesSan: string[];
  clocks: { whiteMs: number; blackMs: number };
  sideToMove: GameColor;
  boardOrientation: 'white' | 'black';
  canInteract: boolean;              // false when it's not your turn or on disconnect
  pendingPromotion: PendingPromotion | null;
  pendingDrawOffer: { from: GameColor } | null;
  result: GameResult | null;
  onMove: (move: MoveInput) => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
  onPromote: (piece: 'q' | 'r' | 'b' | 'n') => void;
}
```

`Board`, `Clock`, `MoveHistory`, `GameActions`, dialogs take `GameViewModel` as props. Hotseat feeds from `useGameStore`, online — from `useOnlineGameStore`. One refactor — two feed points.

**Board orientation:** online — `color === 'black' ? 'black' : 'white'`; hotseat always `'white'`.

#### 2.6.4 Tab sync

A dedicated `BroadcastChannel`/localStorage sync is NOT required — each tab opens its own socket, is authorised by the same user, and joins the `user:{userId}` and `game:{gameId}` rooms. Any server-driven event (`game.state`, `game.end`, `game.drawOffered`, etc.) arrives in every tab. Diff ≤ 500 ms by default.

On `connect` the client emits `hello`. The server reads `GET user:activeGame:{userId}`:
- `gameId` exists → emit `game.snapshot` → `useOnlineGameStore` hydrates;
- `mm:entry:{userId}` exists → emit `queue.joined { mode, since }` → `useMatchmakingStore` hydrates;
- otherwise — silence.

### 2.7 Shared Types (`packages/shared/src/types/`)

- `types/game.ts`: `GameColor`, `GameResult`, `GameEndReason` (all variants listed above).
- `types/socket-events.ts`: `ServerToClientEvents`, `ClientToServerEvents` interfaces for Socket.IO (we type the client and the gateway from one source).
- `types/user.ts`: `Mode` stays as-is (capitalized). Fix in `apps/web/src/features/game/useGameStore.ts` — import `Mode` from `@yanchess/shared` and render in UI via a `MODE_LABELS` helper (`features/shared/mode-labels.ts`): `{ Bullet: 'Bullet', Blitz: 'Blitz', Rapid: 'Rapid', Classical: 'Classical' }`.

### 2.8 Environment variables (`apps/api`)

New/confirmed env in `dev/.env.example`:

- `WEB_URL` — already in use (CORS, email links). Also — list of allowed origins for Socket.IO.
- `SOCKET_IO_PATH` (optional, default `/socket.io`) — transport path (for later behind a proxy).
- All existing (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, etc.) are carried over into a complete `.env.example`.

CORS for Socket.IO: the same allow-list as for HTTP (`WEB_URL`), `credentials: true`.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **On auth**: `TokenVerifierService` — a refactor that does not change HTTP guard behaviour. A regression → breaks all protected HTTP endpoints from spec 001. Mitigation: first extract the service + cover with a unit test, then use it from both guards; the e2e auth suite runs in CI and will catch a regression immediately.
- **On Prisma schema**: adding enums and the `games` table is purely additive and does not break existing migrations.
- **On Redis**: the new keyspaces (`mm:*`, `game:*`, `user:activeGame:*`, `rematch:*`) do not overlap with existing ones (`session:*`, `user:sessions:*`, `rl:*`).
- **On hotseat (`/game`)**: refactoring the game components to prop-driven `GameViewModel` — visually nothing should change; all 44 acceptance criteria of 003 must keep passing. Mitigation: the Vitest suite on `useGameStore` remains, plus a smoke render for the hotseat path.

### 3.2 Potential Risks & Mitigations

- **Clock drift / rubber-banding for a player on bad internet.** The client ticks locally between pushes; on every `game.state` the clocks snap to the server truth → a player may see a jump of -200–500 ms. Mitigation: we do not push `game.state` more often than once per 100 ms (but this won't happen — we push only on moves). The effect is acceptable and expected for online chess.
- **Flag race on simultaneous move and flag fall.** The player moves exactly when the sweep worker records a flag. Mitigation: `GameService.applyMove` first atomically reads `status` from `game:{gameId}` — if `ended`, the move is rejected (`game.moveRejected { reason: 'game_already_ended' }`).
- **Pairing race on scale-out.** Two API instances, both running `@Interval(1000)`, both try to pair the same user. Mitigation: atomic removal from the queue via a Lua script (SREM + ZREM + DEL in a single transaction); the first to succeed gets the pair; the second gets nil and skips the cycle.
- **"Ghost" queue on backend crash.** A user is in the queue, the API instance crashes → the disconnect handler never fired. Mitigation: a TTL of 300 s on `mm:entry:{userId}` + the next worker cycle sees a stale entry and cleans it.
- **A disconnect between client and server during a game and the rating transaction.** The rating recalculated, but `game.end` never reached the client. Mitigation: `game.snapshot` on reconnect returns the final state (`result`, `ratingDeltas`); the client correctly renders the result screen on return.
- **Illegal moves from the client (tampered client).** Mitigation: server-authoritative — every move is checked by `chess.js` on the server; `game.moveRejected` snaps the client back.
- **A single user with two sockets in the queue.** Mitigation: Redis `SADD mm:users:searching userId` before `ZADD`; the second socket receives `queue.joined` idempotently (the server replies "you are already in the queue"; the client shows the same search screen).
- **Postgres performance on `games` as it grows.** For MVP: indexes `(whiteUserId, startedAt desc)`, `(blackUserId, startedAt desc)` are enough. If games reach 10M+ — partitioning by date or archiving. Not in MVP.
- **Lack of Pino/Sentry on the backend.** Diagnosing matchmaking/flag issues will be hard on the bare NestJS Logger. **This is not a blocker for 004, but worth raising as a separate task** (for now we just log via the built-in Logger with gameId/userId in context).

---

## 4. Testing Strategy

### 4.1 Backend (Vitest + Supertest)

- **Unit:**
  - `ChessRulesService` — for a set of FENs we verify correct validation, detection of checkmate/stalemate/insufficient material/threefold repetition/50-move rule (equivalent to the 003 engine).
  - `RatingService.applyGameResult` — table tests: `(1500, 1500, win) → +16/-16`, `(1500, 1500, draw) → 0/0`, asymmetric K at different `gamesPlayed`, sharp deltas with large rating gaps.
  - `MatchmakingService` — isolation via in-memory Redis mock (ioredis-mock): expand delta steps (±100 → ±200 → …), nearest-rating choice, dedupe via `mm:users:searching`.
  - `ClockService` — elapsed subtraction, flag detection, flag-vs-insufficient-material.
- **Integration / e2e (`apps/api/test/e2e/`):**
  - `07-matchmaking.spec.ts` — two supertest clients + socket.io-client, both join the queue → wait for `game.start`; verify the payload (colors, ratings, mode, timeControlMs).
  - `08-online-game.spec.ts` — a complete game from `game.start` to `game.end`: a sequence of moves (including Scholar's mate), verify rating deltas, the `games` row, Redis cleanup.
  - `09-game-reconnect.spec.ts` — a client disconnects, clocks keep ticking on the server, on reconnect `game.snapshot` returns the current state.
  - `10-flag.spec.ts` — a player is offline, flag falls, on the client's return `game.end` arrives with `endReason: 'flag'` (or `flag_vs_insufficient_material`).
  - `11-draw-rematch.spec.ts` — offer/accept/decline a draw, spam protection (10 moves), rematch within the 30-second window and its expiration.

### 4.2 Frontend (Vitest + Testing Library)

- **Unit stores:**
  - `useMatchmakingStore` — mock socket; idle → searching on `joinQueue`, searching → idle on `leaveQueue`, searching → found on `game.start`.
  - `useOnlineGameStore` — mock socket; clocks snap on `game.state`, optimistic move, rollback on `game.moveRejected`, result-hydrate on `game.end`.
  - `clock-math.ts` — reusable pure functions.
- **Integration (jsdom):**
  - `Play.tsx` phases: idle → searching → playing → result → rematch; with a stubbed socket.
  - Regression on hotseat: `/game` renders and plays through the new `GameViewModel` API (previous Vitest tests keep passing).
- **Playwright (deferred):** a real browser-to-browser smoke is needed (two tabs, two sessions, a live backend). We move it to a separate task outside 004 — for MVP Vitest + e2e on the API is enough.
