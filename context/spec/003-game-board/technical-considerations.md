<!--
This document describes HOW to build the feature at an architectural level.
It is NOT a copy-paste implementation guide.

DO:
- Describe data models (table names, key columns, relationships)
- Describe API contracts (endpoints, request/response shapes)
- Reference file paths where code will live
- Note critical configuration requirements

DON'T:
- Include full code implementations
- Write complete schema definitions
- Provide copy-paste config files
-->

# Technical Specification: Game board (hotseat) — 003-game-board

- **Functional Specification:** `/Users/yantsyferov/Desktop/YanChess/context/spec/003-game-board/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

Feature 003 is a pure-frontend addition. No backend services, no API routes, no database changes, and no authentication requirements are introduced. The entirety of state lives in memory and is lost on page refresh, which is acceptable for a hotseat MVP.

Chess rules are delegated entirely to `chess.js@^1`, which is the single source of truth for position legality, SAN generation, FEN serialization, and end-game detection. The board is rendered with `react-chessboard@^4`, which receives the current FEN as a controlled `position` prop and emits square-click and piece-drop events. Game state — including the `Chess` instance, clocks, UI dialogs, and derived phase — is owned by a new Zustand store `useGameStore`. Timers are driven by a `requestAnimationFrame`-based hook `useGameClock` using `performance.now()` for drift-free ms accounting.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Architecture Changes

All new code is confined to `apps/web/`. Two existing files receive additive changes: `src/routes.tsx` gains a `/game` route and `src/components/ui/Header.tsx` gains a "Hotseat" link visible to both guests and authenticated users.

New feature directory: `apps/web/src/features/game/`

- `useGameStore.ts` — Zustand store containing the `Chess` instance, clock state, phase, dialog state, and all actions.
- `useGameClock.ts` — React hook that runs a `requestAnimationFrame` loop, reads elapsed time via `performance.now()`, calls the store's `tickClock` action, and handles `visibilitychange` catch-up on tab restore.
- `chess-engine.ts` — typed helper module over `chess.js`. Exposes `computeLegalDestinations(chess, square)` returning `Set<Square>` for move-highlight computation. If the direct chess.js API is sufficient without a wrapper, this file may be omitted during implementation.
- `game-end.ts` — pure function `detectGameEnd(chess: Chess): GameEndResult | null`. Consolidates the five chess.js end-game predicates (`isCheckmate`, `isStalemate`, `isDraw`, `isInsufficientMaterial`, `isThreefoldRepetition`) into a single typed result that includes winner side. Also contains the flag-fall material sufficiency check described in §2.4.
- `clock-math.ts` — pure helpers: `formatMs(ms: number): string` for "3:00" / "9.3" / "0.0" display, `isWarningZone(ms: number): boolean` for the under-10-second threshold.

New page: `apps/web/src/pages/Game.tsx` — composes all game sub-components, reads from `useGameStore`, renders either `ModeSelector` (phase `"idle"`) or the full board layout (phase `"playing"` or `"ended"`).

New component directory: `apps/web/src/components/game/`

- `Board.tsx` — controlled wrapper around `react-chessboard`. Receives position FEN, last-move highlight squares, legal-destination squares for the selected piece, and handlers for square click and piece drop. Disables `react-chessboard`'s built-in promotion flow and delegates promotion detection upstream to the store action.
- `Clock.tsx` — displays one side's remaining time; takes `side: "white" | "black"`, reads `clock[side]` from the store, applies warning styling when `isWarningZone` returns true.
- `MoveHistory.tsx` — scrollable SAN move list derived from `chess.history()`. Pairs moves into rows (move number, white SAN, black SAN). Auto-scrolls to the last entry via a `useEffect` + `ref` on the list container.
- `ModeSelector.tsx` — four `Card` components for Bullet / Blitz / Rapid / Classical, with single-selection state, and a "Start game" `Button` that calls `startGame(mode)`.
- `GameActions.tsx` — "Resign" and "Offer draw" buttons; hidden or disabled when `phase !== "playing"`.
- `PromotionDialog.tsx` — four piece-icon options (Q / R / B / N), Queen pre-selected, Enter key confirms. Built on the new `Dialog` primitive.
- `ConfirmResignDialog.tsx` — "Resign as white/black?" with Cancel / Confirm. Built on the new `Dialog` primitive.
- `DrawOfferDialog.tsx` — "White/Black offer a draw." with "Decline" / "Accept". Built on the new `Dialog` primitive.
- `ResultModal.tsx` — game-end modal with translated title (e.g. "White wins. Checkmate."), subtitle, "New game", and "Close". Built on the new `Dialog` primitive.

New shared UI primitive: `apps/web/src/components/ui/Dialog.tsx` — thin Tailwind-styled wrapper over `@radix-ui/react-dialog`. Follows the same pattern as the existing `DropdownMenu.tsx` (re-export `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Close` with Tailwind class injection). Provides focus trap, Esc close, and ARIA wiring for all four game dialogs.

### 2.2 Data Model (in-memory only)

The Zustand store holds the following state shape. All state is volatile — no persistence to localStorage or any backend.

| Slice | Type | Notes |
|---|---|---|
| `chess` | `Chess` (chess.js instance) | Mutable instance; `chess.move()` mutates in place. The store triggers re-renders by updating a `fen` derived string alongside it, or by replacing the reference. |
| `mode` | `"bullet" \| "blitz" \| "rapid" \| "classical" \| null` | `null` before a game starts. Retained across "New game" resets so the selector pre-selects the previous choice. |
| `phase` | `"idle" \| "playing" \| "ended"` | Drives which UI layer is shown. |
| `clock` | `{ white: number; black: number; activeSide: "white" \| "black" \| null; lastTickAt: number \| null }` | Time values in milliseconds. `lastTickAt` stores the `performance.now()` reference at the moment the side's clock became active — used for drift-free deduction. |
| `lastMove` | `{ from: Square; to: Square } \| null` | Used by `Board` to apply last-move highlight via `customSquareStyles`. |
| `selectedSquare` | `Square \| null` | Tracks the click-to-move first click. Cleared on second click (move) or re-click on same square. |
| `pendingPromotion` | `{ from: Square; to: Square } \| null` | Non-null triggers `PromotionDialog`. Set when the moving pawn reaches the back rank before calling `chess.move()`. |
| `pendingDrawOffer` | `"white" \| "black" \| null` | Non-null triggers `DrawOfferDialog`. |
| `pendingResign` | `"white" \| "black" \| null` | Non-null triggers `ConfirmResignDialog`. |
| `result` | `{ winner: "white" \| "black" \| "draw"; reason: GameEndReason } \| null` | Non-null triggers `ResultModal`. |

The `GameEndReason` discriminant:

```
type GameEndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "flag_fall"
  | "flag_fall_insufficient_material"
  | "resignation"
  | "draw_agreement"
```

The store exposes these actions:

| Action | Signature | Effect |
|---|---|---|
| `startGame` | `(mode: GameMode) => void` | Resets `chess`, initialises clocks from mode, sets `phase = "playing"`, starts white's clock. |
| `makeMove` | `(from: Square, to: Square, promotion?: PromotionPiece) => void` | Calls `chess.move()`, updates `lastMove`, flips `activeSide`, resets `lastTickAt`, runs `detectGameEnd`. |
| `resign` | `() => void` | Ends game with `reason: "resignation"`, winner is the opponent of `activeSide`. |
| `offerDraw` | `() => void` | Sets `pendingDrawOffer` to `activeSide`. |
| `respondToDraw` | `(accept: boolean) => void` | On accept: `endGame("draw_agreement")`. On decline: clears `pendingDrawOffer`. |
| `tickClock` | `(elapsedMs: number) => void` | Deducts `elapsedMs` from `clock[activeSide]`. If result ≤ 0, calls `endGame` with the appropriate flag-fall reason. |
| `endGame` | `(reason: GameEndReason, winner?: "white" \| "black" \| "draw") => void` | Stops clocks (`activeSide = null`), sets `result`, sets `phase = "ended"`. |
| `newGame` | `() => void` | Resets all slices to `"idle"` state, retains `mode` for pre-selection. |

### 2.3 Component Breakdown

Each component in `apps/web/src/components/game/` is a Tailwind-styled React function component with explicit TypeScript props interfaces. Components read from `useGameStore` directly where they need live state; they receive only the minimal props needed for structural composition. This keeps re-render scope narrow — `Clock` subscribes only to its side's time slice, `MoveHistory` subscribes only to the move history.

`Board.tsx` computes `customSquareStyles` as a memoized `Record<Square, CSSProperties>` merging:
1. Last-move highlight on `lastMove.from` and `lastMove.to` (amber tint).
2. Legal-destination dots on destinations for `selectedSquare` (green tint at ~30% opacity).

`MoveHistory.tsx` derives its display list from `chess.history({ verbose: false })` (SAN strings), grouped into pairs. The last entry receives a distinct background token.

`ModeSelector.tsx` maintains local `selectedMode` state only until "Start game" is pressed — after which the store is authoritative.

`ResultModal.tsx` maps `result.reason` and `result.winner` to human-readable strings using a `const` lookup object (not a switch statement), making future localisation straightforward.

### 2.4 Logic / Algorithms

**Legal-move highlighting.** When `selectedSquare` is set, call `chess.moves({ square: selectedSquare, verbose: true })` to get a `Move[]` array, then map `move.to` into a `Set<Square>`. This set is passed to `Board` as the `legalDestinations` prop and merged into `customSquareStyles`. chess.js already excludes moves that leave the own king in check, so no additional filtering is needed.

**Promotion detection.** Before calling `chess.move()`, inspect whether the moving piece is a pawn (`chess.get(from).type === 'p'`) and the destination rank is `"8"` (white) or `"1"` (black). If yes, set `pendingPromotion = { from, to }` and return without applying the move. The `PromotionDialog` calls `makeMove(from, to, piece)` once the player chooses, completing the deferred move.

**Clock tick and drift correction.** `useGameClock` runs a `requestAnimationFrame` callback. On each frame it calls `performance.now()`, computes `elapsed = now - clock.lastTickAt`, calls `tickClock(elapsed)`, and records a new `lastTickAt`. A `visibilitychange` listener fires when the tab becomes visible; it computes total elapsed time since `lastTickAt` and calls `tickClock` once to catch up. This ensures the clock never over-counts while the tab is hidden (browser throttles rAF) and correctly deducts time on return.

**Flag-fall material check.** When `clock[activeSide]` reaches 0, the winner is determined by whether the opponent can theoretically deliver checkmate. The check is: count the opponent's non-king pieces. If the opponent has only a king, or only a king plus one bishop or one knight, the result is `"flag_fall_insufficient_material"` (draw). Otherwise it is `"flag_fall"` (opponent wins). This is a pure helper in `game-end.ts` that takes the `Chess` instance and the side that flagged.

**End-game detection after each move.** After every successful `chess.move()` call, `detectGameEnd(chess)` is evaluated. The function checks `chess.isCheckmate()` first (returns winner = moving side), then `chess.isStalemate()`, then `chess.isDraw()` (which subsumes `isInsufficientMaterial`, `isThreefoldRepetition`, and `isDrawByFiftyMoves`). For draws via `isDraw()`, a secondary check determines which specific draw sub-reason applies (checking each predicate in order of precedence: insufficient material, threefold, fifty-move, then stalemate as fallback). Returns a typed `GameEndResult` or `null`.

**Clock switch on move.** After a move is applied and `detectGameEnd` returns `null`, `activeSide` is flipped and `lastTickAt` is set to `performance.now()`.

**"New game" cleanup.** Calls `newGame()` on the store: creates a fresh `Chess()` instance, resets all slices to initial values, sets `phase = "idle"`. `mode` is retained so the selector pre-highlights the last-used mode.

**`beforeunload` guard.** In `Game.tsx`, a `useEffect` registers a `beforeunload` listener that sets `event.returnValue` (browser confirm) when `phase === "playing"`. Removed when the component unmounts or `phase` changes to `"ended"`.

### 2.5 Dependencies to Add

| Package | Version | Purpose |
|---|---|---|
| `chess.js` | `^1.0` | Chess rules engine, end-game detection, SAN generation, FEN serialization. |
| `react-chessboard` | `^4` | Board rendering, drag-and-drop and click event handlers, customSquareStyles API. |
| `@radix-ui/react-dialog` | `^1.1` | Modal primitive for PromotionDialog, ConfirmResignDialog, DrawOfferDialog, ResultModal. |

Install via `pnpm add chess.js react-chessboard @radix-ui/react-dialog` run from the repo root (pnpm workspace will scope to `apps/web`).

### 2.6 File Layout

```
apps/web/
  src/
    components/
      ui/
        Dialog.tsx                         # NEW — Radix @radix-ui/react-dialog wrapper
      game/
        Board.tsx                          # NEW
        Clock.tsx                          # NEW
        MoveHistory.tsx                    # NEW
        ModeSelector.tsx                   # NEW
        GameActions.tsx                    # NEW
        PromotionDialog.tsx                # NEW
        ConfirmResignDialog.tsx            # NEW
        DrawOfferDialog.tsx                # NEW
        ResultModal.tsx                    # NEW
    features/
      game/
        useGameStore.ts                    # NEW — Zustand store + actions
        useGameClock.ts                    # NEW — rAF ticker hook
        chess-engine.ts                    # NEW — typed chess.js helpers (optional facade)
        game-end.ts                        # NEW — pure end-game detection
        clock-math.ts                      # NEW — pure clock formatting helpers
    pages/
      Game.tsx                             # NEW — page component
    routes.tsx                             # UPDATE: add /game → Game (no ProtectedRoute)
    components/ui/Header.tsx               # UPDATE: add "Hotseat" link to /game
```

### 2.7 Configuration / Env

No new environment variables. No new build configuration. The `/game` route uses `React.lazy` + `Suspense` wrapping in `routes.tsx` to defer the chess.js + react-chessboard bundle (~130 KB combined) from the initial page load. This is the primary bundle-size mitigation. The lazy boundary is placed at the `Game` page level.

---

## 3. Impact and Risk Analysis

**System dependencies.** Zero backend impact. No API changes. No database migrations. No Redis. No auth service changes. The feature is accessible to unauthenticated guests — no `ProtectedRoute` wrapper on `/game`. The existing `useAuthStore` is read in `Header.tsx` only to decide which nav items to show; no new reads are added in the game feature itself.

**Potential risks and mitigations:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Clock drift under tab throttling | Medium | Use `performance.now()` + `visibilitychange` catch-up; avoid `setInterval`. |
| react-chessboard built-in promotion UI conflict | Medium | Inspect `onPromotionCheck` / `onPromotionPieceSelect` props in v4 API during Slice 2 and disable or override the library's promotion flow to prevent double-dialogs. |
| react-chessboard v4/v5 major API differences | Low | Pin to `^4` in package.json. Confirm the version resolved during `pnpm install`. |
| Chess instance mutability causing stale renders | Medium | After each `chess.move()` call in the store action, update a derived `fen` string slice alongside. Components that need to re-render subscribe to `fen`, not to the mutable `Chess` reference. |
| State loss on page refresh | Low (by design) | Accepted for v1. The `beforeunload` confirm guard is the only mitigation, per §2.4. |
| Accessibility gap on drag-and-drop | Low (known) | Click-to-move path works with keyboard; drag-and-drop is mouse/touch only. Documented as a known limitation for v1. |
| Bundle size regression | Medium | Mitigated by `React.lazy` on the `Game` page component (see §2.7). Chess bundle deferred until `/game` is first visited. |
| Mobile touch on 375 px viewport | Low | react-chessboard supports touch natively; verify layout at 375 px via Playwright during acceptance testing. |
| Hotseat board orientation confusion | Low (accepted) | Board does not flip for black; this is a deliberate hotseat trade-off documented in the functional spec §2.2 and will be addressed in the online matchmaking feature. |

---

## 4. Testing Strategy

Tests live in `apps/web/` and extend the existing Vitest + @testing-library/react setup from feature 002. No new test tooling is required.

**Unit tests (Vitest + jsdom) — pure modules:**

- `game-end.ts`: one test per `GameEndReason` variant. Each test constructs a known FEN with chess.js and asserts the correct typed result from `detectGameEnd`. Covers: checkmate (Scholar's mate position), stalemate (king-in-corner position), insufficient material (two kings), threefold repetition (Kb1→Ka1 loop), fifty-move rule (forced 50 half-moves without capture or pawn move), flag-fall with sufficient material (opponent has queen), flag-fall with insufficient material (opponent has lone king).
- `clock-math.ts`: `formatMs` returns `"3:00"` for 180 000 ms, `"9.3"` for 9 300 ms, `"0.0"` for 0 ms; `isWarningZone` returns `true` below 10 000 ms and `false` at exactly 10 000 ms.
- `useGameStore`: action semantics tested with `renderHook`. `startGame("blitz")` initialises both clocks to 180 000 ms and sets `activeSide = "white"`. `makeMove("e2","e4")` applies the move, flips `activeSide` to `"black"`, clears `selectedSquare`. `resign()` sets `result.reason = "resignation"` with `winner = "black"` when it was white's turn.

**Component tests (Vitest + @testing-library/react):**

- `ModeSelector`: clicking the "Blitz" card makes it visually selected; clicking "Start game" calls `startGame("blitz")`.
- `PromotionDialog`: renders with Queen pre-selected; pressing Enter triggers `makeMove` with `promotion: "q"`; clicking the rook icon triggers `makeMove` with `promotion: "r"`.
- `ResultModal`: given `result = { winner: "white", reason: "checkmate" }`, renders "White wins. Checkmate."; "New game" button calls `newGame`; "Close" button closes the dialog without resetting state.
- `Board`: click on own pawn highlights its legal destinations via `customSquareStyles`; click on a highlighted destination applies the move; click on an illegal destination makes no change.

**Integration tests (Vitest + @testing-library/react) — full game flows rendered via `Game.tsx`:**

- Scholar's mate sequence: render `Game`, start Blitz, apply moves 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7# via store actions, assert `ResultModal` shows "White wins. Checkmate."
- Resign flow: start game, click "Resign", confirm in `ConfirmResignDialog`, assert `ResultModal` shows "White resigned. Black wins."
- Flag-fall: start Bullet (60 000 ms each), call `tickClock(60001)` with white as active, assert `ResultModal` shows "White lost. Flag." (opponent has sufficient material in start position).
- Draw by agreement: start game, click "Offer draw", click "Accept", assert `ResultModal` shows "Draw. By agreement."

**Visual / acceptance tests (Playwright — Feature Testing & Regression slice):**

- Navigate to `/game`, snapshot mode selector.
- Start a Blitz game, verify board at start position with coordinates visible.
- Click a pawn, verify legal-move highlights appear.
- Verify clock displays "3:00" for both sides and white's clock is decreasing.
- Trigger Scholar's mate sequence, screenshot `ResultModal`.
- Verify "Hotseat" link visible in `Header` for both guest and authenticated sessions.
- Verify layout at 375 px viewport width.

Screenshots are saved to `docs/screenshots/003-game-board/` per project convention.
