# Functional Specification: Post-game analysis mode

- **Topic:** After every finished game, run a quick engine pass in the background to classify each of the player's moves into one of 11 chess.com-style quality categories, show a three-tile summary (Standout / Normal / Mistake) in the end-of-game result dialog, and offer an "Analyze" button that runs a deeper engine pass and opens a dedicated analysis page with a vertical evaluation bar, per-move category markers in the move list, and the engine's best-move suggestion highlighted on the board. Results for online games are persisted so the second participant sees them instantly.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Today the moment a game ends the player sees only the result ("You won. Checkmate.") and the rating change. They can revisit the game via replay (spec 006), but it's just moves — no evaluation, no "this was a blunder, this was the correct reply". Learning what went well or badly requires imagining the engine in your head.

This spec adds the engine. In two layers:

- A **fast engine pass** (shallow depth, a few seconds for the whole game) runs automatically in the background the moment the result dialog opens. When it finishes, three count tiles — **Standout** / **Normal** / **Mistake** — light up inside the dialog so the player sees at a glance how the game went.
- A dedicated **analysis page** opens when the player clicks **"Analyze"** in the dialog or on any row in the game history. The page runs a **deep engine pass** (higher depth, up to a minute for a long game), shows a progress bar while it runs, and when it finishes reveals the full UI: a vertical evaluation bar beside the board, a per-move chess-notation quality mark in the move list (**!!** / **!** / **★** / **!?** / **?** / **??** / etc.), and the engine's preferred move drawn as an arrow on the board.

Each of the player's moves is classified into one of **11 categories** modelled on chess.com: Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Blunder, Miss, Forced. Full definitions in §2.4.

Results for **online games are persisted in the database** — the second participant (and any later re-open by either participant) sees the analysis instantly, no re-computation. Analyses of **vs-bot and hotseat games** live only in the current browser tab and are lost on reload (consistent with how those games themselves are not persisted — specs 003, 005).

**The problem we are solving:**
- For **Misha the amateur**: he wants to know "did I actually play well, or did I just get lucky?". The three-tile summary answers that in a glance; the analysis page shows him exactly where the mistakes were.
- For **Anna the club player**: she needs to review losses to catch recurring mistakes. The 11-category breakdown + eval bar + best-move arrow is the toolkit she expects.
- For **the loser of an online game**: opening the analysis page sees the result of the engine run the winner already triggered — zero wait, zero duplicated CPU.

The product definition §3.2 originally listed "Engine-powered game analysis and annotations" as out-of-scope. This spec moves it in-scope.

**How we measure success:**
- From the result dialog opening to the three summary tiles appearing (fast pass completes) — **no more than 10 seconds** for a 40-half-move game on a typical laptop.
- From the player clicking "Analyze" to the analysis page UI being fully revealed (deep pass completes) — **no more than 90 seconds** for a 40-half-move game on a typical laptop.
- For the second participant opening the analysis page after the first participant already finished a deep pass — **under 1 second** to full UI (served from database cache).
- Share of players who click "Analyze" at least once in the week after this ships — **≥ 40%** of players who finish a game.

---

## 2. Functional Requirements (The "What")

### 2.1 Fast-pass summary in the end-of-game result dialog

- **As** a player who just finished a game, **I want** a quick glance at how my moves went, **so that** I know whether to study the game more deeply before I move on.
  - The existing end-of-game result dialog (shown after an online game, a vs-bot game, and a hotseat game) gets a new section below the result + rating-change line, titled **"Your moves"**.
  - The section renders exactly **three count tiles** side by side, in this order:
    1. **Standout** (positive color, e.g. green) — sum of the player's Brilliant + Great + Best moves (§2.4).
    2. **Normal** (neutral color, e.g. grey) — sum of Excellent + Good + Book + Forced moves.
    3. **Mistake** (warning color, e.g. red) — sum of Inaccuracy + Mistake + Blunder + Miss moves.
  - The sum of the three tiles always equals the player's own half-move count. All three tiles are rendered even when a count is 0.
  - For a hotseat game, the breakdown is shown separately per side: **"White: X / Y / Z"** and **"Black: X / Y / Z"**, stacked vertically.
  - **Fast engine pass.** The moment the result dialog opens, the browser kicks off a shallow engine run in a background WebWorker (depth around 10, roughly 0.2 seconds per half-move). The three tiles stay in a "loading" state — a small spinner + text **"Analyzing…"** — until the fast pass finishes, then the tiles populate in place.
  - If the fast pass fails (e.g. the engine crashes), the section shows **"Analysis not available."** with no tiles.
  - **Edge case — very short games.** If the player made 0–2 half-moves (e.g. opponent resigned immediately), the three tiles still render with the actual counts; a game with 0 player moves shows all three at 0 with a one-line note **"Not enough moves to analyze."**
  - **Acceptance Criteria:**
    - [x] Given a player just finished an online Blitz game with 24 of their own half-moves, when the result dialog opens, then they see a "Your moves" section with a spinner + "Analyzing…" in place of the three tiles; within approximately 10 seconds the spinner is replaced by three populated tiles (Standout / Normal / Mistake) whose counts sum to 24.
    - [x] Given a hotseat game ended, when the fast pass finishes, then the "Your moves" section renders two stacked rows ("White: a / b / c" and "Black: a / b / c"), with sums equal to each side's half-move count.
    - [x] Given the fast engine pass crashed, when the section renders, then the player sees "Analysis not available." and no tiles.
    - [x] Given a player's game ended in only 2 of their own half-moves (opponent resigned early), when the fast pass finishes, then the "Your moves" section still shows all three tiles, totaling 2, and no tile is hidden even if its count is 0.

### 2.2 "Analyze" button inside the end-of-game dialog

- **As** a player who wants to study the game, **I want** a one-click way to open the full analysis, **so that** I don't have to search for it later.
  - Below the "Your moves" tiles (and alongside the existing dialog action buttons — "Rematch", "New game", "Close"), a new button appears: **"Analyze"**.
  - The "Analyze" button is always visible when the result dialog is shown, regardless of the fast-pass state and regardless of game mode (online / vs-bot / hotseat). It is clickable even while the fast pass is still in progress.
  - Clicking "Analyze" closes the result dialog and navigates the player to the analysis page (§2.3).
  - The button sits in the same action-row as "Rematch" / "New game" / "Close". Visual prominence is secondary to the primary rematch button; exact styling is a designer call.
  - **Acceptance Criteria:**
    - [x] Given a player just finished a game and the result dialog is open, when they look at the action buttons, then they see the "Analyze" button alongside "Rematch", "New game", and "Close".
    - [x] Given the player clicks "Analyze" while the fast pass is still running, when the navigation completes, then the result dialog closes and the analysis page for this specific game opens.

### 2.3 The analysis page

- **As** a player on the analysis page, **I want** to see the engine evaluation at every move, with the engine's preferred move highlighted, **so that** I understand what went wrong and what I should have played.
  - A new page lives at the URL **`/analysis/:gameId`** for games with a persisted ID (online games), and at **`/analysis/session`** for in-tab games (vs-bot and hotseat — the current-session game is read from in-tab memory and is lost on page reload).
  - **Deep engine pass + full-wait UX.** On opening the page the browser kicks off the deep engine run (depth around 18, roughly 1–2 seconds per half-move). Until the deep pass finishes **the analysis UI is not shown** — instead the page shows a centered "preparing" state:
    - a large progress indicator **"Analyzing… X / N moves"** that increments as the engine finishes each half-move
    - a short reassurance line **"This usually takes under a minute. You can leave this page and come back later."**
    - a **"Cancel"** button that returns the player to wherever they came from (home for post-game, history row for /history, etc.)
    - no eval bar, no board (yet), no move list — those appear only once the deep pass is 100% done
  - When the deep pass finishes, the UI switches in place to the full analysis view (described below). The player can navigate freely among all moves; nothing is pending, nothing shows as "not yet analyzed".
  - **Cached results.** For online games where a previous participant already finished the deep pass, the analysis page skips the engine run entirely — it fetches the cached result from the database and shows the full UI within approximately 1 second. The player sees no progress indicator, just a brief loading state.
  - **Full UI layout** (left-to-right):
    1. **Vertical evaluation bar** down the left side of the board, approximately as tall as the board. Two-color fill (white on top, black on bottom) with the white portion sized proportionally to the current engine evaluation. At `0.0` the bar is 50/50; at `+2.0` for White the white portion fills ~70%; at `+5.0` near-maximum. For a forced mate (e.g. `#5` for White), the bar fills completely with the winning color and the center shows the mate indicator (`M5`).
    2. **Numeric evaluation** displayed next to the bar: `+1.3`, `−0.6`, `0.0`, or `M5` / `#5`. Sign is from White's perspective (positive = White is better).
    3. **The chess board** in replay mode, oriented with the current player at the bottom. A colored **arrow** on the board shows the engine's preferred move at the current position.
    4. **Side panel** (right of the board, or stacked below on narrow screens): move history list + navigation controls (First / Prev / Play-Pause / Next / Last — same shortcuts as spec 006 §2.5) + a text line **"Engine suggests: <SAN>"**.
  - **Per-move markers in the move history list.** Each half-move in the SAN list is annotated with a small inline chess-notation glyph for its category (see §2.4). Clicking any move in the list jumps the board to that position; the evaluation bar, best-move arrow, and "Engine suggests" line all update accordingly.
  - **Keyboard navigation + autoplay.** Same as the replay screen from spec 006: `←` Prev, `→` Next, `Home` First, `End` Last, `Space` Play/Pause; autoplay speeds 1 s / 2 s / 3 s per move; pause-on-manual-control.
  - **Writing results to the database.** During the deep pass, as the engine finishes each move, the client streams the result (bucket, centipawn eval, best-move UCI, engine depth, classifier version) to the server for persistence. On a crash or page close before completion, whatever has been written stays — but the UI never shows a partial result; the next visitor still sees the "Analyzing…" state and continues from where the previous run stopped. For vs-bot / hotseat (session-scoped), nothing is streamed to the server.
  - **"Back" link.** A link above the board (or above the progress indicator while loading) — **"← Back"** — returns the player to wherever they came from: for the result dialog of an online game, home; for a game opened from `/history`, back to `/history` preserving its filter + page state; for a vs-bot or hotseat game, back to `/vs-bot` or `/game` respectively.
  - **Acceptance Criteria:**
    - [x] Given a player opens the analysis page for the first time for a 24-half-move online game, when the page has loaded, then they see a centered "Analyzing… 0 / 24 moves" indicator that increments as the engine progresses, a "Cancel" button, no board and no eval bar; within approximately 60 seconds the indicator disappears and the full UI (eval bar + board + move list + "Engine suggests") replaces it in place.
    - [x] Given the second participant opens `/analysis/<gameId>` after the first participant already finished the deep pass for that game, when the page loads, then within approximately 1 second they see the full analysis UI with no "Analyzing…" indicator.
    - [x] Given the player is on the analysis page and clicks "▶ Next", when the step applies, then the board advances one half-move, the eval bar updates, the suggested-move arrow updates, and the next move is highlighted in the list.
    - [x] Given the player clicks a specific move (e.g. move 15) in the SAN list, when the click fires, then the board jumps to the position after move 15, the eval bar and best-move arrow reflect that position, and the move is highlighted in the list.
    - [x] Given the engine evaluates the current position at `+1.3`, when the player looks at the eval bar, then the white portion fills approximately 65% from the top and the numeric evaluation reads `+1.3`.
    - [x] Given the engine detects a forced mate for White in 5 moves, when the player looks at the eval bar, then the bar fills completely with white and the indicator shows `M5` (or `#5`); the numeric evaluation also reads `M5`.
    - [x] Given the player clicks "Cancel" during the deep pass, when the navigation completes, then they land on the page they came from and the half-finished analysis stays persisted in the database (for an online game) so the next visitor continues from there.
    - [x] Given the player opened the analysis page from a specific history row like `/history?mode=Blitz&page=2`, when they click "← Back", then they land on `/history?mode=Blitz&page=2` with the list state preserved.

### 2.4 Move categorization — eleven categories

- **As** a player studying my moves, **I want** a precise chess.com-style label for each move, **so that** I know whether a move was merely good, best, or something more remarkable or harmful.
  - Every one of the player's half-moves is classified by the engine into exactly one of **11 categories**, each with a visible marker in the move list on the analysis page. Only categories with a non-empty marker are listed in the "Marker" column — Okay-type moves have no marker to keep the list clean.

  | # | Category     | Marker  | Short definition (what the engine checks)                                                                                      |
  |---|--------------|---------|---------------------------------------------------------------------------------------------------------------------------------|
  | 1 | **Brilliant** | **‼️**  | A sacrificial move (gave up at least a minor piece's worth of material) that keeps or increases a winning advantage.           |
  | 2 | **Great**     | **❗**   | The only strong move in the position (every alternative is at least ~150 cp worse than the one that was played).               |
  | 3 | **Best**      | **★**   | The engine's top choice at the full search depth (0 cp difference with the top move).                                          |
  | 4 | **Excellent** | *(none)*| Very close to the best move — ≤ 10 cp lost compared to the engine's top choice.                                                |
  | 5 | **Good**      | *(none)*| A solid move — between 10 cp and 50 cp lost compared to the top move.                                                          |
  | 6 | **Book**      | *(none)*| A standard opening move from a known theoretical line (first ~10 moves of the game that match an opening book).                |
  | 7 | **Forced**    | *(none)*| The player had exactly one legal move in the position (regardless of eval).                                                    |
  | 8 | **Inaccuracy** | **⁉**  | A noticeable mistake — between 50 cp and 150 cp lost.                                                                          |
  | 9 | **Mistake**    | **❓**  | A clear mistake — between 150 cp and 300 cp lost.                                                                              |
  |10 | **Blunder**    | **⁇**  | A severe mistake — more than 300 cp lost compared to the top move.                                                             |
  |11 | **Miss**       | **×**  | After the opponent made a Blunder (handing you a winning advantage of ≥ 300 cp), you failed to play a move that preserved the win. |

  - For every move the engine considers the categories in this fixed priority order: **Forced → Book → Brilliant → Great → Miss → Best → Excellent → Good → Inaccuracy → Mistake → Blunder**. The first matching category wins. (So a move that is both Forced and a Blunder is reported as Forced; the player had no choice.)
  - The three result-dialog tiles from §2.1 are grouped sums of these 11:
    - **Standout tile** = Brilliant + Great + Best.
    - **Normal tile** = Excellent + Good + Book + Forced.
    - **Mistake tile** = Inaccuracy + Mistake + Blunder + Miss.
  - **Acceptance Criteria:**
    - [x] Given the engine evaluates a player's move as 20 cp worse than its top choice, when the move is classified, then it falls into the **Good** category and shows no marker in the move list.
    - [x] Given the player sacrificed a knight (−3.0 material) on their move but the resulting position's engine evaluation is still +2.0 for them, when the move is classified, then it falls into the **Brilliant** category and shows the **‼️** marker.
    - [x] Given the player had only one legal move (forced response to check), when the move is classified, then it is **Forced** regardless of its engine evaluation and shows no marker.
    - [x] Given the opponent just played a Blunder (evaluation jumped from 0.0 to +4.0 for the player) and the player's reply surrendered that advantage (eval back to +0.5 or lower), when the player's move is classified, then it is **Miss** and shows the **×** marker.
    - [x] Given a game ended in 24 half-moves of the player and classification produced Brilliant=1, Best=4, Excellent=5, Good=6, Book=2, Inaccuracy=3, Mistake=2, Blunder=1, when the three result-dialog tiles render, then **Standout = 5** (1 Brilliant + 0 Great + 4 Best), **Normal = 13** (5 Excellent + 6 Good + 2 Book + 0 Forced), **Mistake = 6** (3 Inaccuracy + 2 Mistake + 1 Blunder + 0 Miss), summing to 24.

### 2.5 "Analyze" link inside the game-history row

- **As** a player browsing history, **I want** a quick way to open the analysis for any past game, **so that** I don't need to replay first and switch modes.
  - On the game-history list (both the full `/history` page and the "Recent games" section on the home page), every row gains a secondary link next to the existing **"▶ Replay"** link: **"🔍 Analyze"** (exact icon up to designer).
  - Clicking "Analyze" navigates directly to `/analysis/<gameId>` for that specific game. If a previous participant has already run the deep pass, the player sees cached results instantly; otherwise the deep pass starts.
  - Clicking "Replay" still goes to the step-through replay from spec 006 — the two destinations are intentionally separate.
  - **Acceptance Criteria:**
    - [x] Given a signed-in player opens `/history`, when they look at a game row, then they see both "▶ Replay" and "🔍 Analyze" as inline actions.
    - [x] Given a player clicks "🔍 Analyze" on a row where the deep pass has already been persisted, when the navigation completes, then they land on `/analysis/<that gameId>` and see the full analysis UI within approximately 1 second (no "Analyzing…" state).
    - [x] Given a player clicks "🔍 Analyze" on a row where no participant has run the deep pass yet, when the navigation completes, then they land on `/analysis/<that gameId>` and see the "Analyzing… 0 / N" state while the deep pass runs.

### 2.6 Access control and persistence scope

- **As** a player, **I want** my own game analysis to be visible only to me and the other participant, **so that** my losses aren't exposed to strangers.
  - **Online games.** `/analysis/:gameId` follows the same access rule as the replay page from spec 006 §2.7: only the two players who participated can view it. Any other signed-in user who opens the URL sees a **"Game not available"** screen with a link back to `/history`. A guest hitting the URL is redirected to `/login`.
  - **Deep-pass results for online games are persisted in the database** keyed by `(gameId)`, so the second participant and all future re-opens by either participant see the full UI instantly. The persisted record carries the per-move bucket + centipawn eval + best-move UCI + engine depth + classifier version. If the classifier version in the running code is newer than the stored version, the stored record is treated as stale and a fresh deep pass runs.
  - **Vs-bot and hotseat games.** `/analysis/session` is accessible from the current browser tab only — the data lives in in-tab memory. On a full page reload the session is gone and the page shows a short notice **"The analyzed game is no longer available (session reset). Start a new game to try again."** with a link back to `/vs-bot` or `/game` respectively.
  - Fast-pass results for all game types live in in-tab memory only and are not persisted anywhere; the fast pass re-runs on each new result-dialog mount. (It's fast enough that caching isn't worth the complexity for MVP.)
  - **Acceptance Criteria:**
    - [x] Given alice is signed in and opens `/analysis/<bob-vs-charlie-gameId>` for a game she did not participate in, when the page tries to load, then she sees the "Game not available" screen with a link back to `/history`.
    - [x] Given a guest opens `/analysis/<any-gameId>`, when the page tries to load, then they are redirected to `/login`.
    - [x] Given alice finished a deep pass on an online game and bob (the other participant) opens `/analysis/<same-gameId>` for the first time, when the page loads, then bob sees the full analysis UI within approximately 1 second (no "Analyzing…" state).
    - [x] Given a player opens the analysis page for an in-tab vs-bot session and then presses F5, when the page reloads, then they see the "The analyzed game is no longer available" notice with the link back to `/vs-bot`.

### 2.7 Localization

- **As** a player whose UI language is Russian or Spanish, **I want** the result-dialog tiles, category labels, and analysis-page interface in my language, **so that** the feature is as approachable as the rest of the product.
  - All new user-facing text — "Your moves", "Standout" / "Normal" / "Mistake" tile labels, "Analyze", "Analyzing… X / N moves", "This usually takes under a minute. You can leave this page and come back later.", "Cancel", "Engine suggests: …", "Analysis not available.", "Not enough moves to analyze.", "Game not available", "The analyzed game is no longer available…", "← Back", and the 11 category names (Brilliant, Great, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Blunder, Miss) — is translated into English, Russian, and Spanish.
  - The evaluation bar, the numeric evaluation (`+1.3`, `M5`), the per-move marker glyphs (**‼️** / **❗** / **★** / **⁉** / **❓** / **⁇** / **×**), and the SAN move notation are locale-independent and shown identically in every language.
  - **Acceptance Criteria:**
    - [x] Given a player whose UI language is Russian opens the end-of-game dialog, when the fast pass finishes, then the tile labels, the section title, and the "Analyze" button render in Russian.
    - [x] Given a player whose UI language is Spanish opens the analysis page, when the page has loaded, then the progress indicator ("Analyzing…"), the "Engine suggests: …" line, the "← Back" link, and any hover labels on the per-move markers (e.g. tooltip "Blunder") render in Spanish.

---

## 3. Scope and Boundaries

### In-Scope

- A **fast engine pass** (shallow depth, ~0.2 s / half-move) that runs automatically in a WebWorker when the end-of-game result dialog opens, for all game types (online / vs-bot / hotseat).
- A three-tile summary (**Standout** / **Normal** / **Mistake**) inside the result dialog, populated when the fast pass finishes. Per-side rows for hotseat.
- A **deep engine pass** (higher depth, ~1–2 s / half-move) that runs when the player clicks **"Analyze"** or opens the analysis page directly. Full-wait UX: no analysis UI until the deep pass is 100% complete.
- A dedicated analysis page at `/analysis/:gameId` (persisted online games) and `/analysis/session` (in-tab vs-bot / hotseat).
- Analysis page UI: vertical evaluation bar + numeric eval + chess board with best-move arrow + move list with per-move chess-notation markers + autoplay + keyboard navigation (same shortcuts as spec 006 replay).
- **Eleven move categories** modelled on chess.com: Brilliant / Great / Best / Excellent / Good / Book / Forced / Inaccuracy / Mistake / Blunder / Miss. Precedence order and classification rules in §2.4.
- **Persistence for online games**: deep-pass results written to the database keyed by `(gameId)` — second participant and later re-opens see results instantly. Record carries `bucket + eval(cp) + bestMove UCI + engineDepth + classifierVersion`.
- A **"🔍 Analyze"** link in every game-history row (both the `/history` list and the "Recent games" section on the home page), next to the existing "▶ Replay" link.
- Access control: participants only for persisted online analyses (403-style page for strangers, redirect to login for guests); session-scoped for vs-bot / hotseat.
- Localization of all new strings into English, Russian, and Spanish.

### Out-of-Scope

- Showing an eval bar on the live board **during** an active game — evaluation only appears after the game ends, on the analysis page.
- Side-by-side display of "your move vs engine's best move" with a mini-board — the arrow + "Engine suggests" line is enough for MVP.
- Showing multiple engine lines (principal variations beyond the single best move / multi-PV display to the user) — only the top move is shown. (Internally the engine may use multi-PV to compute Great / Miss, but only the top line is presented.)
- Interactive position editing on the analysis page (dragging pieces to try alternatives) — not in MVP.
- A separate "Opening recap" / "Endgame recap" / "Accuracy %" chess.com-style numeric score — not in MVP; may follow in its own spec.
- Analysis of a game that was abandoned (not finished) — the fast pass and the "Analyze" button appear only when the result dialog is shown, which only happens for finished games.
- Analysis of a position typed in by hand (FEN input / "analyze from arbitrary position") — not in MVP; analysis is tied to a specific finished game.
- **Server-side engine execution** — all engine runs (fast + deep) happen in the player's browser. The server only stores results. A future spec can add server-side pre-computation if needed.
- A re-analysis control ("run the engine again at higher depth") — the deep pass runs once per `(gameId, classifierVersion)` and is cached; bumping the classifier version is the way to re-analyze all games en masse.
- Sharing / exporting the analyzed game as an annotated PGN — deferred along with the general PGN-export work.
- Multi-engine support (Stockfish only, per architecture.md).
- Persisting the game record itself for vs-bot or hotseat (which would enable persistent analysis for them too) — explicitly out-of-scope; vs-bot and hotseat remain session-only per specs 003 and 005.

---

## Change Log

_No amendments yet._
