# Functional Specification: Game history

- **Topic:** A player's online-game archive on their profile page — paginated list with mode/result filters, click-through replay with step controls, autoplay, and jump-to-move. Vs-bot training games are out of scope.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Since spec 004 landed, every finished online game is already written to the `games` Postgres table with full PGN, result, end reason, opponent, mode, and ratings before/after. Players, however, have no way to see what they played — once the result modal closes, the game is gone from the UI. This feature exposes the archive on the profile page and lets players replay any past game move by move.

**Problem we are solving:**
- For **Misha the amateur**: he wants to see "how did I beat/lose that player yesterday?" — right now there's no answer. Reinforcing wins and reviewing losses is a core engagement loop and part of the D7 retention metric from `product-definition.md` §1.4.
- For **Anna the club player**: she wants to review her losses, spot recurring opening mistakes, and compare how she plays blitz vs rapid. A searchable, filterable archive is the baseline for any serious study flow.
- Operationally: the data is there, the table is indexed by `(whiteUserId, startedAt DESC)` and `(blackUserId, startedAt DESC)`. All we are shipping is a read endpoint, a list screen, and a replay screen.

**How we measure success:**
- From opening `/profile` to seeing the first page of games — **no more than 500 ms** on an average laptop over local-network latency.
- From clicking a row in the list to the replay screen showing the opening position — **no more than 500 ms**.
- A player with 50 games can step through any one of them (prev/next/jump) with **no perceptible lag** (< 100 ms per step on the client).

---

## 2. Functional Requirements (The "What")

### 2.1 Game-history section on the profile page

- **As** a signed-in player, **I want** to see a list of my past online games on my profile, **so that** I can revisit my recent results without leaving the profile context.
  - On `/profile`, below the ratings table, a new section titled **"Game history"** appears for every signed-in player.
  - When the player has at least one finished online game, the section renders a list of games in reverse chronological order (newest first), 20 per page, with numbered page controls at the bottom (`Page 1 / 2 / 3 / … / Last`), chess.com style.
  - When the player has no finished online games, the section shows an empty-state card: heading **"No games yet"**, text **"Finish an online game — it will show up here. Training games vs the bot are not saved."**, and two action buttons: **"Find game"** (links to `/`) and **"Play vs bot"** (links to `/vs-bot`).
  - **Vs-bot training games are not included** — per spec 005 §2.8, they are not persisted. The list contains only online matchmaking games.
  - **Acceptance Criteria:**
    - [x] Given a signed-in player with at least one finished online game opens `/profile`, when the page has loaded, then they see a "Game history" section below the ratings table with the first page of 20 games in reverse chronological order.
    - [x] Given a signed-in player has never played an online game, when they open `/profile`, then the "Game history" section shows the empty-state card with the heading "No games yet" and the two action buttons "Find game" and "Play vs bot".
    - [x] Given a signed-in player has played 50 online games and 10 vs-bot games, when they open `/profile`, then the "Game history" section shows only the 50 online games across pages (bot games are not listed).

### 2.2 Game-row layout

- **As** a player scanning the list, **I want** each row to show the essentials at a glance, **so that** I can quickly spot the game I want to revisit.
  - Every row contains:
    1. **Date** — absolute, in local time, formatted `YYYY-MM-DD HH:MM` (e.g. `2026-10-11 20:34`).
    2. **Opponent** — opponent's nickname (plain text, not a link in this MVP) + their rating after this game in parentheses, e.g. `bob (1491)`.
    3. **Mode** — a small colored badge: `Bullet`, `Blitz`, `Rapid`, or `Classical`.
    4. **Result** — colored label from the player's perspective: `Win`, `Loss`, or `Draw`, plus a short reason: `Checkmate` / `Flag` / `Resignation` / `Agreement` / `Stalemate` / `Threefold repetition` / `Fifty-move rule` / `Insufficient material` / `Opponent has insufficient material`.
    5. **Rating change** — signed delta from the player's perspective: `+16`, `−12`, or `0` for a draw at equal ratings. Use a Unicode minus sign for negatives.
    6. **Replay** — a trailing "▶ Replay" link that navigates to `/history/<gameId>`.
  - The whole row is also clickable as a shortcut to the Replay link.
  - Row color accent: faint green background for a win, faint red for a loss, neutral for a draw. The exact palette comes from the design-system tokens from spec 002.
  - **Acceptance Criteria:**
    - [x] Given a player's list contains a game where they played White, won by checkmate against `bob` (rating 1491) in Blitz on 2026-10-11 at 20:34, with their rating going from 1500 to 1516, when they look at the row, then they see: `2026-10-11 20:34 · bob (1491) · Blitz · Win — Checkmate · +16 · ▶ Replay`.
    - [x] Given a player lost by flag, when they look at the row, then the result cell reads `Loss — Flag` with the negative rating change displayed with a Unicode minus sign (e.g. `−16`).
    - [x] Given a player drew by agreement, when they look at the row, then the result cell reads `Draw — Agreement` and the rating change is `0` (or a small signed delta if ratings were not equal).

### 2.3 Filters by mode and result

- **As** a player studying a specific pattern, **I want** to filter the list by mode and by result, **so that** I can focus on "my blitz losses" or "my rapid wins".
  - Above the list, two filter dropdowns appear side by side:
    - **Mode**: `All` (default), `Bullet`, `Blitz`, `Rapid`, `Classical`.
    - **Result**: `All` (default), `Wins`, `Losses`, `Draws`.
  - Selecting a filter immediately re-renders the list from page 1, refetching from the server with the filter applied. The URL updates to carry the filter state (`/profile?mode=Blitz&result=Losses&page=1`) so the view is bookmarkable and the browser's Back button works naturally.
  - If a filter combination has zero results, the list shows a small inline message: **"No games match these filters."** with a "Clear filters" button that resets both dropdowns to `All`.
  - The filter state persists across pagination clicks (going to page 2 keeps the filters).
  - **Acceptance Criteria:**
    - [x] Given a player opens `/profile` with filters at defaults, when they look at the URL, then it reads `/profile` with no query parameters (or just the fragment identifier of the section).
    - [x] Given a player selects `Blitz` in the mode filter, when the list refreshes, then only Blitz games are shown and the URL becomes `/profile?mode=Blitz`.
    - [x] Given a player selects `Blitz` + `Losses`, when the list refreshes, then only Blitz games the player lost are shown, the URL becomes `/profile?mode=Blitz&result=Losses`, and the ratings-table section above the list is unaffected.
    - [x] Given a player applies filters that produce zero rows, when the list renders, then they see the inline message "No games match these filters." and a "Clear filters" button that, when clicked, resets both filters to `All` and reloads the list.
    - [x] Given a player applies `Blitz` filter and goes to page 2, when the page changes, then the URL becomes `/profile?mode=Blitz&page=2` and the filter remains applied.

### 2.4 Pagination

- **As** a player with many games, **I want** standard numbered pagination at the bottom of the list, **so that** I can jump to a specific range of history.
  - Below the list, numbered page controls: `« First  ‹ Prev  1  2  …  N  Next ›  Last »`. Current page is visually highlighted. "Prev"/"First" are disabled on page 1; "Next"/"Last" are disabled on the last page.
  - 20 games per page, server-side pagination. Filters above (if applied) narrow the total before pagination.
  - If the full result set fits on one page, the pagination controls are hidden (not just disabled).
  - **Acceptance Criteria:**
    - [x] Given a player has 55 online games with no filters applied, when they look at the pagination, then they see page controls `1 2 3`, 20 games per page, with page 3 containing 15 games.
    - [x] Given a player is on page 2 of their history, when they click "First", then they navigate to page 1 and the URL updates to drop the `page` query parameter.
    - [x] Given a player has 7 online games total, when they look at the list, then the pagination controls are hidden and all 7 games render on a single page.

### 2.5 Replay — step-through controls

- **As** a player revisiting a game, **I want** to step through the moves one by one, **so that** I can understand the position at any point.
  - Clicking a row (or the "▶ Replay" link) navigates to `/history/:gameId`.
  - The replay screen reuses the shared `Board`, `Clock`, `MoveHistory`, player-card components from specs 003/004. Layout mirrors the online board, but with controls instead of action buttons:
    1. **Player cards** — opponent on top, self on bottom. Each shows nickname + rating-at-end-of-game. The player's own card shows their rating change (`+16`, `−16`, `0`).
    2. **Board** — oriented with the player's own pieces at the bottom (same as the live online game would have shown).
    3. **Clocks** — show the remaining time at the current move index, computed from the move list and per-move durations stored in the game. **MVP simplification:** if per-move timings are not stored (currently they are not — spec 004 only stores final clock state), the clocks show the initial time control until the replay reaches the final move, where they show `0:00` for the flagged side if the game ended by flag; otherwise the clocks are **hidden** in replay mode. This is explicitly documented so engineers don't try to invent per-move clock reconstruction.
    4. **Move history** — list of SAN moves, same layout as the live screen. The move at the current step is visually highlighted.
    5. **Replay controls** — a horizontal bar below the board with five buttons:
       - **⏮ First** — jump to the initial position (move index = 0).
       - **◀ Prev** — step back one half-move.
       - **▶ Play / ⏸ Pause** — toggle autoplay. See §2.6.
       - **▶ Next** — step forward one half-move.
       - **⏭ Last** — jump to the final position (move index = total).
    6. **Keyboard shortcuts**: `←` = Prev, `→` = Next, `Home` = First, `End` = Last, `Space` = Play/Pause.
  - **Clicking a SAN move** in the Move History panel jumps the board to that position.
  - A "← Back to history" link above the board returns the player to `/profile` and restores their filter + page state (via URL query params on return).
  - **Acceptance Criteria:**
    - [x] Given a player clicks "▶ Replay" on a game that lasted 24 half-moves, when the replay page loads, then they see the board in the starting position (move index 0), the full move list on the side, and the five control buttons below the board.
    - [x] Given the player presses "▶ Next" (or `→`), when the step is applied, then the board advances one half-move, the move in the SAN list is highlighted, and the "First" / "Prev" buttons become enabled.
    - [x] Given the player is at move index 10 and clicks the SAN move at index 15 in the list, when the click fires, then the board jumps directly to the position after move 15 and that move is highlighted.
    - [x] Given the player presses `Home`, when the shortcut fires, then the board jumps to the initial position and the move list has no highlighted entry.
    - [x] Given the player clicks "← Back to history" from a replay opened from `/profile?mode=Blitz&page=2`, when the navigation completes, then they land back on `/profile?mode=Blitz&page=2` with the same list state.

### 2.6 Autoplay

- **As** a player watching rather than studying, **I want** an autoplay button so the game plays itself at a steady pace, **so that** I can review on autopilot.
  - Clicking **▶ Play** starts autoplay from the current move index. The icon changes to **⏸ Pause**. Clicking again (or `Space`) pauses.
  - Autoplay advances one half-move at a time at **2 seconds per move** by default. Next to the Play/Pause button, a small speed selector lets the player pick **1 s / 2 s / 3 s** per move (dropdown or three-button toggle; exact UI on the designer).
  - When autoplay reaches the final move, it stops automatically and the icon returns to **▶ Play**. Pressing Play again from the final position restarts from the beginning (jumps to move 0 first).
  - Any manual control (`←` / `→` / clicking a SAN move / `Home` / `End`) pauses autoplay.
  - **Acceptance Criteria:**
    - [x] Given a replay is at move index 0 and the player clicks "▶ Play", when autoplay starts, then within approximately 2 seconds the board advances to move index 1, and continues advancing one half-move every 2 seconds until paused or the game ends.
    - [x] Given autoplay is running at 2 s/move, when the player changes the speed to 1 s/move, then subsequent steps advance every 1 second (the current pending step may still finish at the old rate — that's acceptable).
    - [x] Given autoplay is running, when the player clicks "◀ Prev", then autoplay stops (the icon returns to "▶ Play") and the board steps back one half-move.
    - [x] Given autoplay runs to the final move, when the final move is applied, then autoplay stops automatically and the icon shows "▶ Play".

### 2.7 Access control

- **As** a player, **I want** my game archive to be visible only to me, **so that** my losses stay private until I choose to share them.
  - The `/profile` page is already protected by `RequireAuth` from spec 004. The game-history section inherits that gate.
  - The replay page `/history/:gameId` is accessible only to a signed-in user who was a participant in that specific game (i.e. `whiteUserId === currentUser.id || blackUserId === currentUser.id`). Anyone else gets a 403-style error page with heading **"Game not available"** and a link back to `/profile`.
  - A guest hitting `/history/:gameId` is redirected to `/login` with the standard return-to behavior.
  - **Acceptance Criteria:**
    - [x] Given alice is signed in and opens the direct URL `/history/<bob-vs-charlie-gameId>` for a game she did not participate in, when the page loads, then she sees the "Game not available" screen with a link back to `/profile`.
    - [x] Given a guest opens the direct URL `/history/<some-gameId>`, when the page tries to load, then they are redirected to `/login` with `returnTo` set to the original URL.
    - [x] Given alice is signed in and opens `/history/<her-own-gameId>`, when the page loads, then she sees the replay screen normally.

### 2.8 Loading and error states

- **As** a player, **I want** clear feedback while the list or replay loads, **so that** I'm never looking at a blank screen.
  - List: a small spinner-skeleton covers the rows area while the first fetch is in flight. Once loaded, replacing the skeleton is instant.
  - Replay: a "Loading game..." placeholder covers the board area while the game data is fetched. If the fetch fails (network error, 404, 403), show a short error card: **"Couldn't load game."** with a "Try again" button (retries the fetch). For 403, show "Game not available" instead (per §2.7).
  - **Acceptance Criteria:**
    - [x] Given the list is loading the first page, when the player looks at the section, then they see a skeleton/spinner for less than 500 ms before the actual rows appear.
    - [x] Given the replay fetch fails with a network error, when the error surfaces, then the player sees a card "Couldn't load game." with a "Try again" button.

---

## 3. Scope and Boundaries

### In-Scope

- Game-history section at the bottom of `/profile`, showing the signed-in player's online games in reverse chronological order.
- 20 games per page, numbered pagination (chess.com style), server-side.
- Filters by mode (All/Bullet/Blitz/Rapid/Classical) and result (All/Wins/Losses/Draws), reflected in URL query params.
- Row data: date, opponent (nickname + rating-after), mode, result label + reason, player's rating change, replay link.
- Replay page `/history/:gameId` with Board, Move History, player cards, step controls (First/Prev/Play-Pause/Next/Last), SAN jump, keyboard shortcuts.
- Autoplay at 1 / 2 / 3 seconds per half-move, pause on manual control.
- "Back to history" link that preserves the player's filter and page state via URL params.
- Access control: participants only; 403 for strangers, redirect to login for guests.
- Loading + error states on both screens.

### Out-of-Scope

- Hotseat and vs-bot games — not persisted, not shown.
- Opponent profiles / public game browsing (comes with Friends spec).
- PGN export / download button — explicitly deferred (functional-spec 003 and 004 both marked it out of MVP). Easy to add later as a one-liner.
- Engine analysis / stockfish evaluation overlay — a dedicated "Analysis" spec, not here.
- Per-move clock replay — spec 004 doesn't store per-move durations; adding that is a separate storage change (new `game_moves` table) and belongs in its own spec.
- Search by opponent nickname / position / opening — not in MVP.
- Share link (public URL to a specific replay) — deferred until public profiles exist.
- Delete / hide a specific game from history — not in MVP; the archive is append-only.
- Export to lichess / chess.com studies — not in MVP.
- Pinned games / favorites / annotations — not in MVP.
- Side-by-side comparison of two games — not in MVP.
- Mobile swipe gestures for Prev/Next on the board — nice-to-have, not required for MVP (the control bar is enough; keyboard shortcuts cover desktop).

---

## Change Log

_No amendments yet._
