# Technical Specification: Game history

- **Functional Specification:** `context/spec/006-game-history/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

**No new infrastructure, no schema changes, no sockets.** All data already exists: spec 004's `games` table has `pgn`, `finalFen`, `result`, `endReason`, ratings before/after, timestamps, and both participant FKs. Composite indexes `(whiteUserId, startedAt DESC)` and `(blackUserId, startedAt DESC)` are already in place from the 004 migration.

We ship two new HTTP endpoints (list + single-game), new shared DTOs, a profile-page section, and a replay page. The replay uses `chess.js` client-side to parse PGN and step through moves — the same library already powers hotseat, online, and vs-bot. No per-move clock reconstruction is attempted in MVP (functional-spec §2.5 explicitly accepts static clocks or hidden clocks in replay).

**Affected systems:**
- `apps/api`: new `GameHistoryModule` with a controller + service. No new Prisma models, no migrations.
- `apps/web`: new feature folder `features/history/`, new page `pages/HistoryReplay.tsx`, two added imports in `pages/Profile.tsx` and `routes.tsx`.
- `packages/shared`: three new DTO types for the two endpoints.
- Backend game socket, matchmaking, vs-bot, hotseat — zero changes.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Architecture Changes

- **No new dependencies.** `chess.js` already handles PGN parsing via `chess.loadPgn()` + `chess.history({ verbose: true })`.
- **No TanStack Query migration** — the existing `apiClient.ts` + custom `useEffect` hooks pattern is used, matching the rest of the frontend.
- **No new DB indexes.** Existing composite indexes serve the queries directly.

### 2.2 Backend — new module

Under `apps/api/src/modules/game-history/`:

| File | Responsibility |
|---|---|
| `game-history.module.ts` | NestJS module; imports `PrismaModule`; declares controller + service; registered in `AppModule`. `JwtAuthGuard` is used via `@UseGuards` on the controller (same pattern as `UsersModule`). |
| `game-history.controller.ts` | Thin controller, `@Controller('api/v1')`. Two routes, both `@UseGuards(JwtAuthGuard)`. |
| `game-history.service.ts` | Prisma queries + WHERE composition + perspective mapping + access control. |
| `dto/get-game-history-query.dto.ts` | `class-validator` DTO for query params. |

### 2.3 API Contracts

**`GET /api/v1/users/me/games`** — paginated list for current user.

Query params (validated via `GetGameHistoryQueryDto`):
- `mode?: "Bullet" | "Blitz" | "Rapid" | "Classical"` — invalid value → 400
- `result?: "wins" | "losses" | "draws"` — invalid value → 400
- `page?: integer ≥ 1` — default 1
- `perPage` — fixed at 20 on the server. If client sends another value, coerce to 20 (don't reject — prevents brittle client breakage).

Response (`GameListResponse`):

```ts
{
  games: Array<{
    gameId: string;
    mode: Mode;
    playerColor: "white" | "black";
    opponent: { nickname: string; ratingAfter: number };
    result: "win" | "loss" | "draw";           // perspective of current user
    endReason: GameEndReason;
    ratingBefore: number;                       // current user's rating before
    ratingAfter: number;                        // current user's rating after
    ratingDelta: number;                        // signed
    startedAt: string;                          // ISO
    endedAt: string;                            // ISO
  }>;
  pagination: { page: number; perPage: 20; totalGames: number; totalPages: number };
}
```

**`GET /api/v1/games/:gameId`** — single game for replay.

Response (`GameReplayResponse`):

```ts
{
  gameId: string;
  mode: Mode;
  timeControlMs: number;
  pgn: string;                                   // full PGN with headers
  finalFen: string;
  white: { userId: string; nickname: string; ratingBefore: number; ratingAfter: number };
  black: { userId: string; nickname: string; ratingBefore: number; ratingAfter: number };
  result: "white_win" | "black_win" | "draw";    // raw server shape — client flips to perspective
  endReason: GameEndReason;
  startedAt: string;
  endedAt: string;
}
```

**Access control:**
- Game not found → `NotFoundException` with body `{ error: { code: "GAME_NOT_AVAILABLE" } }`.
- Game found but user is not a participant → `ForbiddenException` with the same body shape. Identical body prevents existence disclosure.

### 2.4 Prisma queries — list WHERE composition

Base participant predicate: `baseWhere = { OR: [{ whiteUserId: userId }, { blackUserId: userId }] }`.

Composition rules:
- No filters: `where = baseWhere`.
- Mode only: `where = { ...baseWhere, mode }`.
- Result = `wins`: replace `baseWhere.OR` with the perspective-aware OR — `{ OR: [{ whiteUserId: userId, result: "white_win" }, { blackUserId: userId, result: "black_win" }] }`.
- Result = `losses`: same shape, swap win/loss sides.
- Result = `draws`: `{ AND: [baseWhere, { result: "draw" }] }`.
- Mode + result: wrap as `{ AND: [resultWhere, { mode }] }`.

This keeps the `wins`/`losses` shapes aligned with the existing composite indexes — Postgres can run an index-union bitmap scan across both. If `EXPLAIN ANALYZE` ever shows sequential scans at scale, the next step is a `UNION ALL` rewrite or a materialized `game_participants` view — out of MVP scope, documented as a future optimization.

Pagination execution:

```
const [totalGames, games] = await Promise.all([
  prisma.game.count({ where }),
  prisma.game.findMany({
    where,
    orderBy: { startedAt: "desc" },
    skip: (page - 1) * 20,
    take: 20,
    include: {
      whiteUser: { select: { nickname: true } },
      blackUser: { select: { nickname: true } },
    },
  }),
]);
```

Row-mapping to the perspective view:
- `playerColor = game.whiteUserId === userId ? "white" : "black"`
- `opponent.nickname / ratingAfter` — opposite side's columns.
- `result`: `game.result === "draw" → "draw"`; else win/loss based on color match.
- `ratingBefore / ratingAfter / ratingDelta` from the player's own color's columns.

All five perspective fields are derived from one boolean — logic stays in one small pure helper in the service, unit-testable in isolation.

### 2.5 Shared DTOs

Add to `packages/shared/src/types/history.ts` (new file) and re-export from `packages/shared/src/index.ts`:

- `GameListItem` — per-row shape above.
- `GameListResponse` — `{ games: GameListItem[]; pagination: { page, perPage: 20, totalGames, totalPages } }`.
- `GameReplayResponse` — single-game wire shape above.
- `GameHistoryResultFilter = "wins" | "losses" | "draws"`.

Client-only computed fields (`verboseMoves`, `movesSan`, `myColor`) are **not** in shared — they're derived client-side.

### 2.6 Frontend — new feature folder

Under `apps/web/src/features/history/`:

| File | Responsibility |
|---|---|
| `useGamesList.ts` | Hook: reads `mode / result / page` from `useSearchParams`, calls `apiGet<GameListResponse>("/users/me/games?...")`, exposes `{ games, pagination, loading, error, refetch }`. `useEffect` keyed on `[mode, result, page]`. |
| `GameHistorySection.tsx` | Section composition: heading, `<HistoryFilters />`, list body (skeleton rows / rows / empty state / no-match state), `<HistoryPagination />`. |
| `HistoryFilters.tsx` | Two `<select>` elements. On change: `setSearchParams({ mode, result, page: "1" })` — always reset page to 1. |
| `GameRow.tsx` | One row: date, opponent, mode badge, result label + reason, signed delta, "▶ Replay" link. Row click → `navigate(/history/:gameId, { state: { returnTo: location.search } })`. |
| `HistoryPagination.tsx` | Chess.com-style controls (First / Prev / windowed page numbers / Next / Last). Hidden when `totalPages ≤ 1`. |
| `useGameReplay.ts` | Hook: fetches `/games/:gameId`, parses PGN with `chess.js`, exposes computed `verboseMoves`, `movesSan`, `myColor`, plus loading/error. 403 → `error = "forbidden"`; network → `error = "network"`. |
| `useReplayPlayer.ts` | State machine over `verboseMoves`: `currentIndex`, `isPlaying`, `speed`. Derives `fen` via `useMemo([currentIndex, verboseMoves])` by replaying moves from scratch. Autoplay runs via `setInterval(speed)` with `useRef` for stale-closure avoidance. Any manual action pauses autoplay. |
| `ReplayControls.tsx` | 5 IconButtons (⏮ ◀ ▶/⏸ ▶ ⏭) + speed selector (1s / 2s / 3s). |
| `ReplayBoard.tsx` | Assembles a `GameViewModel` from replay state (`canInteract: false`, all callbacks no-op, `result` populated only at `currentIndex === totalMoves`). Renders shared `<Board>`, `<MoveHistory>` (with `onMoveClick → jumpTo`), two player cards. Clocks shown as static initial values or hidden (per functional-spec §2.5). |

New page:

| File | Responsibility |
|---|---|
| `apps/web/src/pages/HistoryReplay.tsx` | Reads `:gameId`. Composes `useGameReplay` + `useReplayPlayer`. On 403 → "Game not available" card + link to `/profile`. On network error → "Couldn't load game." + "Try again". On loading → "Loading game…" placeholder. Otherwise board + controls + "← Back to history" link to `/profile${returnTo}`. Attaches global keyboard listener for `← → Home End Space`. |

Patches to existing files:
- `apps/web/src/routes.tsx` — add lazy route `/history/:gameId` wrapped in `<ProtectedRoute>` (plain, no `redirectState`).
- `apps/web/src/pages/Profile.tsx` — render `<GameHistorySection />` below `<RatingTable />`.

### 2.7 Replay — chess.js integration

```ts
// in useGameReplay, after fetch success:
const chess = new Chess();
chess.loadPgn(data.pgn);
const verboseMoves = chess.history({ verbose: true }); // [{ from, to, promotion?, san }, ...]
const movesSan = verboseMoves.map(m => m.san);
```

`useReplayPlayer`'s `fen` is `useMemo([currentIndex, verboseMoves])`: `const c = new Chess(); for (let i = 0; i < currentIndex; i++) c.move(verboseMoves[i]); return c.fen();`. O(n) per render, n ≤ ~200 half-moves in practice — well within budget. Memoized so re-renders at the same index are free.

`lastMove = verboseMoves[currentIndex - 1] ?? null` — used by the shared Board for highlight.

### 2.8 URL state and navigation

- Section lives at `/profile`; filter + page use `useSearchParams`.
- Default values (`mode="All"`, `result="All"`, `page=1`) are **not** written to the URL — `setSearchParams` omits default keys to keep `/profile` clean.
- Row click: `navigate("/history/" + gameId, { state: { returnTo: location.search } })`.
- "← Back to history" uses `const returnTo = (location.state as any)?.returnTo ?? ""; <Link to={`/profile${returnTo}`}>`.

### 2.9 Keyboard shortcuts

Single `useEffect` on `HistoryReplay.tsx`, registers `keydown` on `window`. Skips when `e.target` is an input or button to avoid conflicts. Keys:
- `ArrowLeft` → prev
- `ArrowRight` → next
- `Home` → first
- `End` → last
- `Space` → togglePlay (with `preventDefault`)

All five action callbacks come from `useReplayPlayer` wrapped in `useCallback`, so the effect's dep array stays stable and doesn't re-register per render.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Spec 004 Game model** — relied on as the sole source of game data. No schema changes required; all fields exist.
- **Spec 003 shared `GameViewModel` + Board / MoveHistory / Clock components** — reused for replay. No changes needed.
- **Spec 001 auth** — `JwtAuthGuard` + user profile for `myUserId` resolution. No changes.
- **Backend sockets / matchmaking** — zero changes; this feature is REST-only.
- **Hotseat and vs-bot** — zero changes; those games are not persisted and don't surface here.

### 3.2 Potential Risks & Mitigations

- **OR query performance at scale.** The `baseWhere.OR` participant filter could degrade when a single user has 10K+ games (unlikely in MVP). Mitigation: Postgres index-union across the two composite indexes handles this well up to tens of thousands of rows per user. If verify shows regression, document `UNION ALL` rewrite or a materialized participant column for future spec. MVP keeps the simple OR.
- **PGN parsing failure in replay.** If a stored PGN is malformed (e.g. older corrupt game), `chess.loadPgn` throws. Mitigation: wrap in try/catch in `useGameReplay`, set `error = "network"` (reused label; functional spec allows generic error card). Add a server-side validation step at write time in a future hardening pass.
- **Access-control enumeration.** Returning different error bodies for 404 vs 403 would leak game existence. Mitigation: both use `{ error: { code: "GAME_NOT_AVAILABLE" } }` — identical body.
- **Rating-delta display drift.** `ratingDelta = ratingAfter - ratingBefore` is a pure derivation server-side. If future rating changes become non-ELO (Glicko-2 was rejected, but future), delta may need re-sourcing. Mitigation: current ELO logic in spec 004 writes before/after as integers; delta is always integer subtraction. Safe.
- **Autoplay drift when tab is backgrounded.** `setInterval` throttles to 1s minimum in background tabs — autoplay at 2-3s is unaffected; 1s may run at 2s. Not worth fixing in MVP.
- **Dates / timezone.** Server returns ISO; client renders in local TZ via `Date` + `Intl.DateTimeFormat(undefined, { ... })` or `toLocaleString`. Documented in `GameRow.tsx` responsibility.

---

## 4. Testing Strategy

### 4.1 Backend — Vitest + Supertest

**Unit** (`apps/api/test/unit/`):
- `game-history.service.ts` perspective mapping: given a `Game` row + userId, assert correct `playerColor / opponent / result / ratings / delta`.
- WHERE composition helper: given `(userId, mode?, result?)`, assert the exact Prisma `where` shape (snapshot-friendly).

**E2E** (`apps/api/test/e2e/`):
- `12-game-history.spec.ts` — using the existing e2e framework:
  - Seed via existing matchmaking + resign flow: play one game (alice vs bob), end with alice win by resignation.
  - `GET /users/me/games` as alice → one row, `result: "win"`, `opponent.nickname: "bob"`, correct deltas.
  - As bob → one row, `result: "loss"`.
  - Filter: `?result=wins` as bob → empty.
  - Filter: `?mode=Rapid` on a Blitz game → empty.
  - Pagination: play 25 games (or seed via `prisma.game.createMany`), hit `page=2` → 5 games (unless 25-game seeded, then 5 on page 2 of 25-indexed 20/5 split).
  - `GET /games/:gameId` as alice → full replay response.
  - `GET /games/:gameId` as charlie (non-participant) → 403.
  - `GET /games/:unknownId` → 404 with same body shape.
  - Guest (no auth) → 401 on both endpoints.

### 4.2 Frontend — Vitest + Testing Library

**Unit:**
- `useGamesList.ts` — mock `apiGet` to return fixtures; assert `useEffect` triggers on param changes, `error` state on 500.
- `useReplayPlayer.ts` — given 10 verboseMoves, assert `first/prev/next/last/jumpTo/togglePlay` behavior; FEN memoization doesn't crash on empty moves array; autoplay stops at the end.
- Perspective-mapping helper (if extracted shared between back + front, which it is NOT — belongs server-side only).

**Integration:**
- `GameHistorySection` — mock `useGamesList`; assert skeleton while loading, rows after load, empty state at 0 games, no-match state with filter button, pagination render.
- `HistoryFilters` — changing dropdowns updates `useSearchParams` and resets `page` to 1.
- `GameRow` — win/loss/draw rows have correct accent class; row click triggers `navigate` with `returnTo` state.
- `HistoryPagination` — First/Prev disabled at page 1; windowing shows `1 2 3 … 10`.
- `HistoryReplay` with mocked `useGameReplay`:
  - Normal replay → board renders, 5 controls render.
  - Click Next 3× → `fen` updates per step, `lastMove` highlights.
  - Click SAN move 5 → `currentIndex === 5`.
  - Click Play → autoplay fires via fake timers at 2s intervals.
  - Keyboard: fire `ArrowRight` → `next` called.
  - 403 error → "Game not available" card renders with Back link.

### 4.3 Playwright

Not configured in this project — same choice as prior specs. The Vitest + mocked backend is sufficient for MVP acceptance.

### 4.4 Regression check

- All 199 web tests + 35 api e2e + 26 api unit remain green.
- Specs 003/004/005 behavior unaffected (no shared code modified, except `Profile.tsx` adds a child component).
