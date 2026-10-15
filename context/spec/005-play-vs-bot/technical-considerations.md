# Technical Specification: Play vs bot (Stockfish)

- **Functional Specification:** `context/spec/005-play-vs-bot/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

**A fully frontend-only feature.** Stockfish runs as a Web Worker with a WASM engine right in the player's browser — no server resources, no API endpoints, no writes to Postgres or Redis. This closes the open decision from `architecture.md §7` in favour of client-side for training games (training doesn't affect rating and isn't persisted — everything fits a one-tab lifecycle).

Move flow: the player moves → the store applies locally via `chess.js` (the same library as in hotseat/online) → the store asynchronously calls `engine.bestMove(fen, movetime)` on the Stockfish worker → the resulting UCI move is parsed and applied via `chess.js` → the UI renders.

**Reusable components from specs 003/004:** the shared `GameViewModel` interface, `Board`, `Clock`, `MoveHistory`, `PromotionDialog`, `ConfirmResignDialog`, `GameActions`, something like `ResultModal`. The only minimal change is an optional `showDrawOffer?: boolean` prop on `GameActions` so a game vs bot does not render a meaningless "Offer draw" button.

**Affected systems:** only `apps/web`. A new feature folder `apps/web/src/features/vs-bot/`, a new route `/vs-bot`, small patches to Header, Home.tsx, GameActions. The shared package `@yanchess/shared` — no changes (all required types are already exported or will be local). Backend and Prisma — no changes.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Architecture Changes

- **New dependency** `apps/web/package.json`: `stockfish` (official npm, ~1.5 MB WASM, single-threaded).
  - **Choice rationale:** the single-threaded build does NOT require `SharedArrayBuffer` → there is no need for the CORS headers `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` in Vite dev and prod. NNUE variants (`@niklasf/stockfish-nnue.wasm`) require these headers and complicate deployment behind CDN/reverse proxy. For the 800–2100 ELO range classical evaluation is more than sufficient.
  - **Vite asset handling:** import the loader via ESM; `.wasm` is copied by Vite automatically via `?url` or `assetsInclude`. Verify that the artifact is available at `/assets/stockfish-*.wasm` in dev and prod builds before release.
  - **Lazy-loading:** the engine module is loaded via a dynamic `import()` inside `useEffect` on `/vs-bot` mount. Stockfish does not land in the main bundle.

- **Other dependencies** (`chess.js`, `react-chessboard`, Zustand, react-router) — already installed for specs 003/004, nothing is added.

### 2.2 Routes and Entry Points

| File | Change |
|---|---|
| `apps/web/src/routes.tsx` | add a lazy route `/vs-bot` → `VsBot.tsx` without `ProtectedRoute` (functional §2.1 — guests allowed) |
| `apps/web/src/components/ui/Header.tsx` | add a second nav link "Vs bot" → `/vs-bot` next to the existing "Play"; visible to all (guest + logged-in) |
| `apps/web/src/pages/Home.tsx` | in the logged-in branch under `<PlayOnlineBlock />` add `<PlayVsBotBlock />`; don't touch the guest branch |

### 2.3 New files in `apps/web/src/features/vs-bot/`

| File | Responsibility |
|---|---|
| `bot-levels.ts` | const `BOT_LEVELS` — 5 configs (key, label, elo, description); helper `BOT_LEVEL_BY_KEY` |
| `stockfish-engine.ts` | wrapper over the Stockfish Web Worker; interface `BotEngine` (`init`, `setLevel`, `bestMove`, `terminate`); UCI strings hidden inside |
| `useVsBotStore.ts` | Zustand store for the game vs bot (setup + runtime + actions) |
| `useVsBotGameViewModel.ts` | hook that assembles a `GameViewModel` from the store to feed shared components |
| `useVsBotGameClock.ts` | rAF hook for ticking the clock (like `useOnlineGameClock`) |
| `VsBotSetup.tsx` | setup screen (level/color/mode + "Start game" button) |
| `VsBotBoard.tsx` | game screen (board + clocks + cards + history + actions + dialogs + result modal) |
| `VsBotResultModal.tsx` | perspective-aware result screen (like `OnlineResultModal` minus the rating delta) |
| `PlayVsBotBlock.tsx` | home-page card linking to `/vs-bot` (symmetrical to `PlayOnlineBlock`) |

**And a new page-level:**

| File | Responsibility |
|---|---|
| `apps/web/src/pages/VsBot.tsx` | a thin orchestrator: reads `phase` from the store, renders `VsBotSetup` or `VsBotBoard`; on mount `engine.init()`, on unmount `engine.terminate()` |

**Patches to existing files:**

| File | Patch |
|---|---|
| `apps/web/src/components/game/GameActions.tsx` | add `showDrawOffer?: boolean` (default `true`); vs-bot passes `false`, the "Offer draw" button is not rendered |

### 2.4 Stockfish Engine Wrapper

**Public interface** `apps/web/src/features/vs-bot/stockfish-engine.ts`:

```ts
export interface BotEngine {
  init(): Promise<void>;                    // creates the worker, sends uci + isready, waits for uciok + readyok
  setLevel(level: BotLevel): Promise<void>; // sets UCI options for the chosen level
  bestMove(fen: string, movetimeMs: number): Promise<string>; // returns UCI move "e2e4" / "e7e8q"
  terminate(): void;                        // "quit" + worker.terminate()
}
```

**Lifecycle:** one worker for the whole lifetime of the `/vs-bot` route. `bestMove` is promise-based — resolves on the first `bestmove <move>` line from the worker. An internal `pending: boolean` guards against concurrent calls (shouldn't happen by store design, but we defend anyway).

**UCI options per level:**

| Level (key / ELO) | UCI commands |
|---|---|
| `beginner` / 800 | `setoption name Skill Level value 0` |
| `amateur` / 1200 | `setoption name Skill Level value 5` |
| `clubPlayer` / 1500 | `setoption name UCI_LimitStrength value true` + `setoption name UCI_Elo value 1500` |
| `strong` / 1800 | `setoption name UCI_LimitStrength value true` + `setoption name UCI_Elo value 1800` |
| `expert` / 2100 | `setoption name UCI_LimitStrength value true` + `setoption name UCI_Elo value 2100` |

**Engine cap `UCI_Elo`** — from ~1320 upwards. For 800/1200 we use `Skill Level` (0–20), which works across the full range. When switching between these two modes we explicitly disable `UCI_LimitStrength` (`value false`) when moving to Skill Level, so options don't conflict.

**Response movetime per level:**

| Level | `go movetime <ms>` | SLA from functional spec |
|---|---|---|
| 800 | 500 | ≤1s (easy) |
| 1200 | 500 | ≤1s |
| 1500 | 800 | ≤1s |
| 1800 | 2000 | ≤3s |
| 2100 | 2500 | ≤3s |

For 800/1200 Stockfish will respond faster than `movetime` → the store wraps a minimum 500 ms artificial delay so there's no feeling of an "instant" move.

### 2.5 `useVsBotStore` (Zustand)

Shape (conceptually):

```ts
type PlayerColor = "white" | "black";

interface Setup {
  level: BotLevel;                 // default "clubPlayer"
  color: PlayerColor | "random";   // default "white"
  mode: Mode;                       // default "Blitz"
}

interface VsBotState {
  phase: "setup" | "playing" | "result";
  setup: Setup;
  // runtime (populated by startGame, cleared by newGame)
  playerColor: PlayerColor | null;
  fen: string;
  movesSan: string[];
  clocks: { whiteMs: number; blackMs: number };
  sideToMove: PlayerColor;
  lastMove: { from: string; to: string } | null;
  lastSyncClientMs: number;
  pendingPromotion: { from: string; to: string } | null;
  pendingResign: boolean;
  result: { winner: PlayerColor | "draw"; reason: GameEndReason } | null;
  resultModalDismissed: boolean;
  botThinking: boolean;
}
```

Public actions (called from the view model and `VsBot.tsx`):

- `setLevel / setColor / setMode` — only in `phase === "setup"`
- `startGame()` — resolves `"random"` color by a coin flip, initializes runtime, `phase → "playing"`. If `playerColor === "black"`, sets `botThinking: true` immediately — the effect in `VsBot.tsx` will fire the engine
- `playerMove(from, to, promotion?)` — validates via the built-in Chess instance, applies, flips `sideToMove`, updates `lastSyncClientMs`, calls `detectGameEnd` (reused from `apps/web/src/features/game/game-end.ts`); if the game continues — `botThinking: true`
- `applyBotMove(from, to, promotion?)` — internal (not in the view model), symmetric to `playerMove`, ends with `botThinking: false`
- `requestResign / cancelResign / resign` — mirrors hotseat; `resign()` sets `result` + `phase: "result"`
- `openPromotion / cancelPromotion` — as in hotseat
- `dismissResult()` — `resultModalDismissed: true`
- `newGame()` — resets runtime, `phase: "setup"` (setup values preserved)
- `rematch()` — same level + mode, swap color (or re-roll the coin on `"random"`), inline `startGame` logic
- `tickClock()` — subtracts elapsed from the active side; on a flag calls `detectFlag`-equivalent (reused from `clock-math.ts`) and sets `result`

**The internal `Chess` instance** lives in a closure in the store and is not exposed. This is the same pattern as `useGameStore` in hotseat.

### 2.6 `GameViewModel` extensions and view model

We extend `GameViewModel` with one optional flag via a local override (no changes in the shared type):

```ts
interface VsBotGameViewModel extends GameViewModel {
  showDrawOffer: false;    // always false
  botThinking: boolean;    // for the "thinking..." indicator on the bot's card
}
```

`useVsBotGameViewModel` assembly:
- `boardOrientation = playerColor` (fallback `"white"`)
- `canInteract = sideToMove === playerColor && !botThinking && result === null`
- `pendingDrawOffer = null` always
- `onOfferDraw / onRespondDraw` — no-op (`GameActions.showDrawOffer=false` → the button isn't rendered and isn't called)
- `onResignClick → store.requestResign`, `onResignConfirm → store.resign`, `onResignCancel → store.cancelResign`
- `onMove → store.playerMove`, `onPromote → store.*`, `onDismissResult → store.dismissResult`, `onNewGame → store.newGame`

### 2.7 Bot turn integration (in `VsBot.tsx`)

```ts
useEffect(() => { void engine.init(); return () => engine.terminate(); }, []);

useEffect(() => {
  if (!botThinking || result !== null) return;
  void (async () => {
    await engine.setLevel(level);                     // idempotent but safe to call on every move
    const uci = await engine.bestMove(fen, movetimeFor(level));
    const parsed = { from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] };
    store.applyBotMove(parsed.from, parsed.to, parsed.promotion);
  })();
}, [botThinking, fen, level, result]);
```

**Bot's first move when the player is black:** `startGame()` itself sets `botThinking: true`, and the same effect raises the engine and the bot opens the game. Delay — minimum `movetimeFor(level)` or 500 ms (functional §2.3 requires ≤1s — even for `expert` 2500 ms exceeds that, so for the first move the bot uses `Math.min(movetimeFor(level), 1000)`).

### 2.8 Clocks

As in hotseat (client-authoritative). `useVsBotGameClock` — rAF/setInterval(100 ms) hook that subtracts `Date.now() - lastSyncClientMs` from the `sideToMove`'s clock. A separate `useVsBotClockTick` effect once per rAF calls `store.tickClock()`, which detects the flag (with the `insufficient_material` check for the opposite side via the hotseat `chess-engine.ts` utility).

### 2.9 ResultModal and rematch

`VsBotResultModal`:
- Perspective-aware title: "You won. Checkmate.", "You lost. Flag.", "Draw. Stalemate."
- **No** `Rating: X → Y` line
- Three buttons: Rematch / New game / Close
- "Rematch" → `store.rematch()` — same level + mode, swap color (or reroll for `"random"`)
- "New game" → `store.newGame()` — return to setup with saved values
- "Close" → `store.dismissResult()` — the modal closes, the board is visible with the final position, clocks are stopped, the "Resign" button is hidden (via `GameViewModel.result !== null` → `canAct=false`)

### 2.10 Logic / Algorithm — Bot move parsing

UCI string from Stockfish:
- Simple move: `"e2e4"` → `{ from: "e2", to: "e4" }`
- Promotion: `"e7e8q"` → `{ from: "e7", to: "e8", promotion: "q" }`
- Castling: `"e1g1"` / `"e8c8"` — passed as a regular king move; chess.js recognizes castling from context
- En passant capture: `"e5d6"` — same, chess.js applies en passant from context

We apply via `chess.move({ from, to, promotion })`. If it returns `null` (shouldn't happen — Stockfish only produces legal moves, but we defend): log a warning and resign the game on the bot's behalf (`result = { winner: playerColor, reason: "resignation" }`).

Game-end detection after every move (player's OR bot's): reuse `detectGameEnd(chess)` from `apps/web/src/features/game/game-end.ts` — check for checkmate / stalemate / insufficient material / threefold / 50-move.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Hotseat (spec 003)** — reuses `Board`, `Clock`, `MoveHistory`, `PromotionDialog`, `ConfirmResignDialog`, `GameActions`, `game-end.ts`, `clock-math.ts`. The `GameActions.showDrawOffer?: boolean` patch is backward-compatible (default `true`).
- **Online (spec 004)** — not affected. Backend modules `MatchmakingService`, `GameService`, `RatingService` — unchanged. Shared socket.ts, useAuthStore, useOnlineGameStore — not touched.
- **Backend** — zero changes. No new endpoints, migrations or tables.

### 3.2 Potential Risks & Mitigations

- **Load-size regression:** Stockfish WASM ~1.5 MB — substantial for the first visit to `/vs-bot`. Mitigation: lazy-load the engine on route mount (the main bundle doesn't grow). Acceptable for a feature of this scale.
- **WASM MIME-type in production:** some hosts serve `.wasm` with the wrong `Content-Type: application/octet-stream`, which breaks `WebAssembly.instantiateStreaming`. Mitigation: ensure the CDN (Cloudflare) serves `.wasm` as `application/wasm`. Fallback: the Stockfish loader falls back to `instantiate` → it still works, just starts slower.
- **Engine not responding (worker hung / out-of-memory):** the `bestMove` promise never resolves → the UI shows "bot thinking" forever. Mitigation: `Promise.race` with a timeout (for example, `movetime * 3 + 2000ms`); on trigger show a toast "Bot stopped responding. Reload the page" and set `result = { ..., reason: "resignation", winner: playerColor }`. For MVP — can be omitted (not a blocker), add later.
- **Clock drift in a game >30 minutes:** client clocks in Classical can accumulate drift from tab switching / laptop sleep. Mitigation: as in hotseat (spec 003) — acceptable for a training game. The problem is not specific to vs-bot.
- **Bot strength deviates from the target ELO:** UCI_Elo + Skill Level are **approximate** scales; real playing strength may differ from the declared value by ±100-200 ELO depending on position and movetime. Acceptable for MVP — spec §1 budgets a ±10% margin. Calibration (shifting targets, increasing movetime, choosing another preset) is a separate task.
- **Promotion UX with the bot:** if the player playing vs the bot reaches a promotion state, the modal opens, the player chooses a piece → the store first applies the player's move, then raises `botThinking`. No race. Mitigation: the review path is covered in the verify slice.
- **Guest state loss:** a guest plays for 15 minutes, accidentally hits F5 — the game is lost. This is a **deliberate** compromise of functional §2.9. For MVP ok.

---

## 4. Testing Strategy

### 4.1 Unit (Vitest, `apps/web`)

- `bot-levels.ts` — all five levels are unique, labels non-empty, ELO targets correct.
- `useVsBotStore` — mock the engine (`engine.bestMove` returns a given UCI):
  - `startGame` with `color: "white"` → runtime initializes, `botThinking: false` right away.
  - `startGame` with `color: "black"` → `botThinking: true` right away, `playerColor: "black"`.
  - `playerMove(e2, e4)` — applies, flips sideToMove, `botThinking: true`.
  - `applyBotMove(e7, e5)` — applies, flips, `botThinking: false`.
  - `rematch()` — swap color, runtime rebuilt.
  - `tickClock()` — subtracts elapsed, detects flag.
- `stockfish-engine.ts` — mock Web Worker (`globalThis.Worker` is replaced in the setup), verify that `init()` sends `uci` → `isready` in the right order, `bestMove` resolves on a `bestmove ...` message.

### 4.2 Integration (Vitest + Testing Library)

- `VsBotSetup` — choice of level / color / mode correctly updates the store; clicking "Start game" transitions `phase → "playing"`.
- `VsBotBoard` — renders the board, a "Bot Club Player (1500)" card, 3:00 clocks, a "Resign" button, does NOT render "Offer draw".
- `VsBotResultModal` — three perspectives (win/loss/draw) with correct titles.
- `VsBot.tsx` end-to-end with a mocked engine: setup → startGame → playerMove → (bot's move via mock) → playerMove → playerMove → resign → result.

### 4.3 Manual browser smoke

- Run through live one game of each of the 5 levels — to make sure the bot moves and doesn't hang.
- Check `/vs-bot` as guest and as signed-in — both branches render.
- Promotion, castling, en passant with the bot — visually.
- Mobile viewport 375px — board and setup screen fit.

### 4.4 Regression 003 / 004

- All existing hotseat Vitest tests (useGameStore, Board, Clock, components) — must keep passing. `GameActions.showDrawOffer?` default `true` preserves current behavior.
- Online e2e (`07-online-game.spec.ts`) — not affected, the backend engine is unchanged.

### 4.5 Playwright (optional, deferred)

A real live run with the WASM engine through Playwright — deferred to a separate task if needed. Vitest + manual smoke is enough for the MVP acceptance criteria of spec 005.
