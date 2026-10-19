# Technical Specification: Post-game analysis mode

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Completed
- **Authors:** AWOS /awos:tech, with sections drafted by specialist subagents (chess-engine-specialist, postgres-redis-data, nestjs-backend, react-frontend)

---

## 1. High-Level Technical Approach

The feature spans four stacks:

1. **Postgres (Prisma):** two new tables (`game_analyses` + `game_analysis_moves`) with a `MoveCategory` enum. One analysis record per `Game`, keyed by `gameId` (unique FK), with per-move rows for each half-move. Partial writes are supported — a NULL `completed_at` signals an incomplete record so the next visitor can resume rather than restart.
2. **NestJS API:** a new `GameAnalysisModule` with three endpoints — `GET /games/:gameId/analysis` (cached results), `PUT /games/:gameId/analysis/moves/:index` (idempotent per-move upsert), `POST /games/:gameId/analysis/finalize` (metadata + completion stamp). Participant-only access using the same opaque `GAME_NOT_AVAILABLE` code pattern as `GameHistoryService`.
3. **Shared types + Zod:** `MoveCategory` as a `const`-tuple + Zod `z.enum`, `AnalysisMove`, `AnalysisResponse`, request bodies — in `packages/shared/src/{types,schemas}/analysis.ts`. No Prisma dependency in `@yanchess/shared`.
4. **Frontend (React + Stockfish WASM):** a new `analysis` feature folder owns two hooks (`useFastAnalysis`, `useDeepAnalysis`), a Zustand store `useAnalysisStore` (session-only), three shared presentational components (`<MoveQualityTiles>`, `<AnalyzeButton>`, `<EvalBar>`, `<AnalysisBoard>`, `<MoveListAnnotated>`), and a lazy-loaded `/analysis/:gameId` + `/analysis/session` route. All three existing result modals (`OnlineResultModal`, `VsBotResultModal`, hotseat `ResultModal`) gain the shared `<MoveQualityTiles>` + `<AnalyzeButton>` block. Game-history `GameRow` gets a sibling "🔍 Analyze" link next to "▶ Replay". A new `analysis.json` i18n namespace is added for en/ru/es.

The Stockfish WASM binary (`stockfish-19-lite-single.{js,wasm}`) is already in the bundle from spec 005 (vs-bot); we extend the worker message protocol to drive a sequential game analysis. The existing `stockfish-engine.ts` wrapper is left untouched — a new `features/analysis/analysis-engine.ts` wraps the same worker with a different interface (Multi-PV, streaming per-move callbacks, `AbortSignal` cancellation).

No new npm dependencies except `chess-openings` (~40 KB, MIT) for the Book-move opening-book lookup. No infrastructure changes.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Database Schema

Two tables (not JSONB) — the primary query is "fetch all moves for game X ordered by index", and partial per-move upserts are much simpler as row writes than as `jsonb_set` surgery.

**`game_analyses`**

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `game_id` | `UUID` | no | — | FK → `games.id`, **UNIQUE** (one analysis per game) |
| `classifier_version` | `INT` | no | — | Bump to invalidate cached results |
| `engine_depth` | `INT` | no | — | Depth used for the deep pass |
| `completed_at` | `TIMESTAMPTZ(3)` | yes | `NULL` | `NULL` = partial, non-null = full pass done |
| `created_at` | `TIMESTAMPTZ(3)` | no | `now()` | |

**`game_analysis_moves`**

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `analysis_id` | `UUID` | no | — | FK → `game_analyses.id`, `ON DELETE CASCADE` |
| `move_index` | `INT` | no | — | 0-based half-move index |
| `player_color` | `TEXT` | no | — | `'white'` or `'black'` |
| `category` | `MoveCategory` | no | — | Enum (below) |
| `evaluation_cp` | `INT` | yes | `NULL` | Centipawns; `NULL` when `mate_in` is set |
| `mate_in` | `INT` | yes | `NULL` | Positive = mate for mover; `NULL` if not forced mate |
| `best_move_uci` | `VARCHAR(5)` | no | — | e.g. `"e2e4"`, `"e7e8q"` |

**Composite `UNIQUE (analysis_id, move_index)`** — prevents duplicates during streaming retries + covers the ordered fetch index.

**`MoveCategory` enum** — Prisma:

```prisma
enum MoveCategory {
  Brilliant
  Great
  Best
  Excellent
  Good
  Book
  Forced
  Inaccuracy
  Mistake
  Blunder
  Miss
}
```

**Indexes:**
- `game_analyses.game_id` — implicit `UNIQUE` index.
- `game_analysis_moves (analysis_id, move_index)` — composite UNIQUE serves both the FK + the ordered fetch, no separate index needed.

**FK cascade policy:** `game_analysis_moves → game_analyses` uses `ON DELETE CASCADE` (deleting an analysis cleans up its moves). `game_analyses → games` uses the default `Restrict` — no delete path exists today, so a future game-delete flow must explicitly delete the analysis first.

**Migration name:** `20261017000000_add_game_analysis`.

**Row-count projection:** 1M games × 60 half-moves ≈ 60M rows ≈ ~9 GB data + ~3 GB index = ~12 GB total. Postgres handles this comfortably; `(analysis_id, move_index)` keeps queries index-covered. If growth hits 100M games, hash partitioning on `analysis_id` is the next lever.

### 2.2 Backend API

New standalone `GameAnalysisModule` at `apps/api/src/modules/game-analysis/` — not an extension of `GameHistoryModule` (separation of concerns, module convention).

```
src/modules/game-analysis/
  game-analysis.module.ts
  game-analysis.controller.ts
  game-analysis.service.ts
  dto/
    write-analysis-move.dto.ts
    finalize-analysis.dto.ts
```

Imports `PrismaModule`; provides existing `JwtAuthGuard` + `TokenVerifierService`.

**Endpoints:**

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/games/:gameId/analysis` | JWT | — | `AnalysisResponse` | 404 no analysis, 403 non-participant, 400 bad UUID |
| `PUT` | `/games/:gameId/analysis/moves/:index` | JWT | `WriteAnalysisMoveBody` | `{ ok: true }` | 404, 403, 400 |
| `POST` | `/games/:gameId/analysis/finalize` | JWT | `FinalizeAnalysisBody` | `{ ok: true }` | 404, 403, 400 |

`PUT` for per-move writes (idempotent per `(gameId, index)` upsert). Separate `POST /finalize` so the client sends `classifierVersion + engineDepth + completedAt` only when the deep pass is 100% done.

**Service responsibilities (`GameAnalysisService`):**
- `getAnalysis(gameId, userId)`: participant check → `prisma.gameAnalysis.findUnique({ where: { gameId }, include: { moves: { orderBy: { moveIndex: 'asc' } } } })` → map to `AnalysisResponse`.
- `upsertMove(gameId, userId, index, body)`: participant check → upsert parent `GameAnalysis` if absent → upsert move row (idempotent).
- `finalizeAnalysis(gameId, userId, body)`: participant check → `prisma.gameAnalysis.update({ where: { gameId }, data: { completedAt: new Date(), classifierVersion, engineDepth } })`.

**Shared types** — new files in `packages/shared/src/`:
- `types/analysis.ts`: `MOVE_CATEGORIES` `as const` tuple + `MoveCategory` union + `AnalysisMove`, `AnalysisResponse`, `WriteAnalysisMoveBody`, `FinalizeAnalysisBody` interfaces.
- `schemas/analysis.ts`: Zod schemas mirroring the types (`moveCategorySchema`, `writeAnalysisMoveSchema`, `finalizeAnalysisSchema`, `analysisResponseSchema`).
- Export both via `packages/shared/src/index.ts`.

**Access control & concurrency:**
- Participant check reproduces the two-line Prisma query from `GameHistoryService` locally — not extracted to a shared guard for MVP (do it when a third consumer appears).
- Concurrent writes from two players are safe: `upsertMove` is idempotent per `(gameId, index)`; `finalizeAnalysis` is idempotent per `gameId`.
- Stale-version detection: client reads `classifierVersion` from `AnalysisResponse`, compares to the embedded `CLASSIFIER_VERSION` constant; if stale, ignores cache and overwrites.

**Error pattern:** matches existing shape:
```json
{ "error": { "code": "GAME_NOT_AVAILABLE" } }     // 403/404
{ "error": { "code": "ANALYSIS_NOT_FOUND" } }     // 404 (GET only)
{ "error": { "code": "VALIDATION_ERROR", "details": [...] } }  // 400
```
`403` and `404` both use the opaque `GAME_NOT_AVAILABLE` to avoid leaking game existence to non-participants.

### 2.3 Engine & Classifier (frontend)

**One new file: `apps/web/src/features/analysis/analysis-engine.ts`** — wraps the same `/stockfish-19-lite-single.js` WASM worker but with a different interface than the vs-bot wrapper (Multi-PV, per-move streaming, `AbortSignal`). The existing `features/vs-bot/stockfish-engine.ts` is untouched (bot engine singleton remains purpose-built for `bestMove(fen, movetime)`).

**Interface shape:**

```
interface AnalysisEngine {
  init(): Promise<void>;
  analyzeGame(params: {
    positions: string[];          // one FEN per half-move
    multiPV: number;              // 2 fast / 3 deep
    depth: number;                // 10 fast / 18 deep
    onProgress: (index: number, result: HalfMoveAnalysis) => void;
    signal: AbortSignal;
  }): Promise<HalfMoveAnalysis[]>;
  terminate(): void;
}

interface HalfMoveAnalysis {
  halfMoveIndex: number;
  topMoves: { uci: string; cp: number; mate: number | null }[];
  depth: number;
}
```

**Multi-PV & cancellation.** Before each `go depth N`, the engine issues `setoption name MultiPV value <N>` (2 fast / 3 deep). On `AbortSignal.abort()` the wrapper sends `stop`, waits for the trailing `bestmove`, and discards the partial half-move. Full `worker.terminate()` happens only on component unmount.

**Classifier precedence** (first match wins — see fspec §2.4):

```
1. Forced       legalMoveCount === 1
2. Book         isBookMove === true
3. Brilliant    materialDelta <= -300 AND evalAfter >= 150 AND cpLoss <= 50
                (MVP proxy for "forced capture reply"; documented in classifierVersion)
4. Great        topMoves[0].cp - topMoves[1].cp >= 150 AND played === topMoves[0].uci
5. Miss         prevOpponentWasBlunder AND evalAfter < evalBefore - 299
6. Best         played === topMoves[0].uci AND cpLoss <= 0
7. Excellent    cpLoss <= 10
8. Good         cpLoss <= 50
9. Inaccuracy   cpLoss <= 150
10. Mistake     cpLoss <= 300
11. Blunder     catch-all
```

`cpLoss = evalBefore - evalAfter` where `evalBefore` is the engine's top-move eval at the position-before-move, and `evalAfter = -nextPosition.topMoves[0].cp` (negated because side-to-move flipped). Mate scores are normalised to `±10000 - N` for arithmetic uniformity; the UI renders `#N` separately.

**Opening book — `chess-openings` npm (MIT, ~40 KB):** at build time, convert the ECO array of PGN lines into a `Set<string>` keyed by UCI move-list prefix (up to 10 half-moves). Runtime lookup: `isBookMove(movesSoFar)` — returns `true` iff the exact prefix exists. Once a game departs the book, all subsequent moves are non-Book. Rejected: Polyglot `.bin` (150-500 KB + Zobrist parser) — overkill for MVP.

**Classifier version:**

```ts
// top of apps/web/src/features/analysis/analysis-engine.ts
export const CLASSIFIER_VERSION = 1;
```

Written into every persisted record. Bumping it is the sole lever to invalidate all cached deep-pass results.

**Performance expectations** — validated on reference position (starting pos, go depth 18 multipv 3) on an M-series MacBook:
- Fast pass: depth 10, MultiPV 2 → ~0.2 s/half-move → 40-move game in **~8 s** (within 10 s SLA).
- Deep pass: depth 18, MultiPV 3 → ~1.5 s/half-move → 40-move game in **~60 s** (within 90 s SLA).

**Known MVP simplifications** (documented in `CLASSIFIER_VERSION = 1`):
- Brilliant: `cpLoss ≤ 50` as proxy for "forced capture reply" instead of a true engine sub-search.
- The starting-position eval (needed for move 0's `evalBefore`) is fetched as an extra depth-10 analysis call.

### 2.4 Frontend

**File map — new files:**

| Path | Responsibility |
|---|---|
| `src/features/analysis/analysis-engine.ts` | WASM wrapper (see §2.3) |
| `src/features/analysis/classifier.ts` | Pure classification logic (precedence rules) |
| `src/features/analysis/opening-book.ts` | ECO-based book-move lookup |
| `src/features/analysis/useAnalysisStore.ts` | Zustand store (session-only): deep-pass results + progress |
| `src/features/analysis/useSessionAnalysisStore.ts` | Holds `{ pgn, playerColor, source }` for `/analysis/session` handoff |
| `src/features/analysis/useFastAnalysis.ts` | Hook: shallow pass, returns `{ status, buckets }` |
| `src/features/analysis/useDeepAnalysis.ts` | Hook: deep pass, streams per-move callbacks, cancellation |
| `src/features/analysis/MoveQualityTiles.tsx` | Shared tiles for all 3 result modals |
| `src/features/analysis/AnalyzeButton.tsx` | Shared button with `gameRef` discriminated union |
| `src/features/analysis/AnalysisPage.tsx` | Orchestrator: cache vs deep pass vs loading state |
| `src/features/analysis/AnalysisBoard.tsx` | `react-chessboard` + `customArrows` for best move |
| `src/features/analysis/EvalBar.tsx` | Vertical bar + numeric eval + mate indicator |
| `src/features/analysis/MoveListAnnotated.tsx` | SAN list with per-move glyph markers |
| `src/features/analysis/AnalysisProgressView.tsx` | Full-wait "Analyzing… X/N" + Cancel |
| `src/features/analysis/analysisService.ts` | `apiGet`/`apiPut`/`apiPost` wrappers |
| `src/pages/Analysis.tsx` | Thin page: `useParams` → `AnalysisPage` |
| `src/i18n/locales/{en,ru,es}/analysis.json` | All new strings (×3) |

**File map — amended files:**

| Path | Change |
|---|---|
| `src/routes.tsx` | Lazy `/analysis/:gameId` + `/analysis/session` routes inside ProtectedRoute block |
| `src/features/online/OnlineResultModal.tsx` | Insert `<MoveQualityTiles>` + `<AnalyzeButton>` above action row |
| `src/features/vs-bot/VsBotResultModal.tsx` | Same + populate `useSessionAnalysisStore` on Analyze click |
| `src/components/game/ResultModal.tsx` | Same for hotseat; tiles show two rows (White/Black) |
| `src/features/history/GameRow.tsx` | `<Link to="/analysis/<id>">Analyze</Link>` next to Replay link |
| `src/i18n/locales/{en,ru,es}/history.json` | Add `analyze.link` key |

**State management:**
- Fast pass → local React state only (hook owns worker, cleans up on unmount).
- Deep pass → Zustand `useAnalysisStore` (session-only, Map keyed by gameId or "session"); state machine `idle → fetching-cache → (cached | running-deep-pass) → done | error | cancelled`.
- Vs-bot / hotseat handoff → `useSessionAnalysisStore` populated on "Analyze" click before navigation; `AnalysisPage` reads on mount; null → "no longer available" notice.

**Routing — new routes inside `ProtectedRoute / AuthenticatedLayout`:**

```tsx
const Analysis = lazy(() => import("./pages/Analysis").then((m) => ({ default: m.Analysis })));

<Route path="/analysis/:gameId" element={<Suspense ...><Analysis /></Suspense>} />
<Route path="/analysis/session" element={<Suspense ...><Analysis /></Suspense>} />
```

**Known routing edge case:** hotseat (`/game`) and vs-bot (`/play/ai`) are currently public (no auth required). Placing `/analysis/session` behind `ProtectedRoute` means a guest playing against the bot cannot analyze their game. For MVP: `/analysis/session` is auth-gated — guests see a "sign in to analyze" redirect, consistent with how analysis for online games requires sign-in. If this becomes a complaint, a follow-up spec can open `/analysis/session` to guests.

**Best-move arrow:** `react-chessboard`'s `customArrows: [Square, Square, string][]` prop; `AnalysisBoard` derives from `bestMoveUci`:
```ts
const arrows = bestMoveUci
  ? [[bestMoveUci.slice(0, 2), bestMoveUci.slice(2, 4), "rgba(0,180,0,0.75)"]]
  : [];
```

**Eval bar scaling:** `whitePercent = 50 + 50 * Math.tanh(evalCp / 400)`. Mate converts to `±∞`, `tanh` clamps to 100%/0%.

**i18n — new namespace file `analysis.json`:**

```jsonc
{
  "yourMoves": "Your moves",
  "tiles": { "standout": "Standout", "normal": "Normal", "mistake": "Mistake" },
  "status": {
    "analyzing": "Analyzing…",
    "analyzingProgress": "Analyzing… {{done}} / {{total}} moves",
    "notAvailable": "Analysis not available.",
    "notEnoughMoves": "Not enough moves to analyze.",
    "notAvailableSession": "The analyzed game is no longer available (session reset). Start a new game to try again.",
    "gameNotAvailable": "Game not available",
    "reassurance": "This usually takes under a minute. You can leave this page and come back later.",
    "loading": "Loading…"
  },
  "buttons": { "analyze": "Analyze", "cancel": "Cancel", "back": "← Back" },
  "engineSuggests": "Engine suggests: {{san}}",
  "categories": {
    "brilliant": "Brilliant", "great": "Great", "best": "Best",
    "excellent": "Excellent", "good": "Good", "book": "Book",
    "forced": "Forced", "inaccuracy": "Inaccuracy", "mistake": "Mistake",
    "blunder": "Blunder", "miss": "Miss"
  },
  "hotseat": { "white": "White", "black": "Black" }
}
```

### 2.5 Backward Compatibility & Rollout

- No breaking changes to existing endpoints. New endpoints are additive.
- No Prisma schema changes to existing tables — only new tables + enum.
- Existing result modals keep their current props + behaviour; the new `<MoveQualityTiles>` + `<AnalyzeButton>` are additive renders.
- `VsBotResultModal` and the hotseat `ResultModal` currently use hardcoded English strings — this spec adds i18n (`useTranslation("analysis")`) alongside the new components. The existing hardcoded strings in those modals are **not** migrated as part of this spec; that's a separate i18n backfill.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **No new npm deps on the backend.**
- **One new frontend dep:** `chess-openings` (~40 KB gzipped, MIT) for Book-move detection.
- **No Prisma schema changes to existing tables.** New: 2 tables + 1 enum.
- **No infrastructure change** — Fly, Neon, Upstash all unaffected. Postgres grows by ~12 GB at 1M analyzed games (negligible for Neon's scale).
- **Stockfish WASM bundle unchanged** — already shipped by spec 005 (1.8 MB WASM + ~40 KB JS loader).

### 3.2 Risks & Mitigations

| Risk | Mitigation |
|---|---|
| WebWorker message protocol: existing worker wasn't designed for sequential game analysis (it's bot `bestmove` only). The new wrapper must maintain a `positionIndex` cursor + handle `bestmove` as the advance signal. | Keep the stateful UCI loop inside `analysis-engine.ts`, not inside the worker. The worker remains stateless; the wrapper queues one position at a time, waits for `bestmove`, advances. |
| Fast pass runs on result-modal mount and the user may navigate away before it finishes (click "Rematch" / "Close"). | `useFastAnalysis` cleanup fires UCI `stop` + `worker.terminate()` on unmount. Partial fast-pass results never render — the three tiles only populate when the pass completes. |
| `evalAfter` derivation requires analyzing position-after each move, which means the engine processes N+1 positions for N moves (extra starting-position call). | Document in `analysis-engine.ts`. Negligible performance hit (~0.2 s extra). |
| Multi-PV in Stockfish lite-single: cost scales ~linearly, N=3 at depth 18 is ~1.6× slower than N=1. | Deep-pass SLA (90 s for 40-move game) assumes N=3. Validated: ~60 s on reference hardware, well within budget. If a user has a very slow machine, the "This usually takes under a minute" copy becomes a soft lie — acceptable for MVP. |
| Partial deep-pass resume: a user closes the tab at 20/40 moves. The spec says "whatever has been written stays — but the UI never shows a partial result." | API returns the partial record. Frontend reads `completed_at`; if null, treats as cache miss, starts a fresh deep pass. Future optimisation: skip already-analyzed indices by inspecting the moves array; not in MVP. |
| Concurrent deep passes by both participants in the same game simultaneously. | DB upserts are idempotent per `(gameId, index)` — last write wins, both arrive at the same final state. The engine depth / classifier version are also identical (compiled constant), so no divergence. |
| `/analysis/session` after F5. | `useSessionAnalysisStore` is in-memory only; on refresh it's null. `AnalysisPage` renders the "no longer available" notice immediately. Documented in fspec §2.6. |
| `/analysis/session` auth gate blocks guest-vs-bot users. | For MVP: accepted trade-off; guest sees sign-in redirect. Follow-up spec can open the route to guests if demand arises. |
| Narrow screens — 3-column layout (EvalBar + Board + Side) too wide for mobile. | `AnalysisPage` uses Tailwind responsive utilities: `flex-col md:flex-row`; `EvalBar` rotates to horizontal strip above the board on narrow viewports. |
| Row count at 100M analyzed games (way beyond current scale). | Noted; hash partitioning on `analysis_id` is the lever. Not an MVP concern. |
| Opening-book false negatives (uncommon openings fall out of the ~3000 ECO lines). | Acceptable for MVP — a legitimate novelty will be classified by the eval rules (Best / Excellent / etc.) which is still correct feedback. Players don't care if move 5 of their Alekhine Defence shows as "Book" or "Best". |

---

## 4. Testing Strategy

### 4.1 Backend

- **Unit** (`apps/api/test/unit/`):
  - `GameAnalysisService.getAnalysis` — participant check (own game → ok; stranger → 403; non-existent → 404; no analysis → 404).
  - `upsertMove` — idempotency (same `(gameId, index)` twice → single row, last values).
  - `finalizeAnalysis` — stamps `completedAt` + metadata.
- **E2E** (`apps/api/test/e2e/`):
  - Full round-trip: register alice + bob, create a game via existing matchmaking helpers (or direct Prisma insert), alice PUTs 10 move analyses, bob GETs → sees 10 moves ordered correctly.
  - Non-participant: charlie GETs alice+bob's analysis → 403.
  - Guest hitting any endpoint → 401.

### 4.2 Frontend

- **Unit** (Vitest + Testing Library):
  - `classifier.ts` — table-driven tests for all 11 categories using synthetic eval numbers (fast, no engine needed).
  - `opening-book.ts` — known opening prefixes return `true`, novelties `false`.
  - `useFastAnalysis` — mock the worker, assert state transitions (`idle → running → done`).
  - `MoveQualityTiles` — three variants: loading, done, error, hotseat-two-rows.
  - `EvalBar` — centipawn → percentage conversion; mate rendering.
  - `MoveListAnnotated` — correct glyph per category.
- **Integration:**
  - `AnalysisPage` — cached results path (no engine run); deep-pass miss path (spawns worker); cancel button cleanup.
  - All three result modals — tiles + Analyze button rendered; Analyze click navigates.

### 4.3 Classifier SLA guardrail (chess-engine subagent recommendation)

A single long FTR test runs `analyzeGame` on a known 10-half-move PGN at depth 10, measures wall time, asserts completion within 5 s. This gives CI a regression guard on engine-wrapper performance.

### 4.4 FTR Slice (standing per AWOS)

- Register alice, play a 10+ move online game vs bob (via API helpers), both open `/analysis/<gameId>`, assert: tiles populate, deep pass completes, move markers appear, best-move arrow renders. The second visitor sees cached result.
- Classifier version bump: with a stored analysis at version 1 and compiled constant now 2, visitor sees fresh deep pass run (not cached data).

---

## 5. Open Questions & Deferrals

All functional-spec `[NEEDS CLARIFICATION]` markers were resolved before this tech plan was written. Deferred to later specs (per fspec §3):
- Server-side engine pre-computation (currently all analysis is client-side).
- Multi-PV display to the user (shown multiple candidate lines).
- Interactive position editing on the analysis page.
- Opening recap / Endgame recap / Accuracy % score.
- Guest access to `/analysis/session`.

---

## 6. Next Steps

Run `/awos:tasks` to generate the vertical-slice task list for this spec.
