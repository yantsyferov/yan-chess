# Functional Specification: Matchmaking and online game

- **Topic:** Opponent search by rating via queue, online game with moves over the network, synchronization between tabs of the same player, disconnect handling, rating recalculation and rematch
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Right now on YanChess you can only play hotseat on a single screen (spec 003). This gives us a battle-tested engine, clock and result screen, but it doesn't deliver the product's main value proposition: **a live opponent online**. This feature closes MVP core functionality — "press one button → play against another human of your level, and the game affects your rating".

**The problem we are solving:** a player who registered on YanChess sees their starting rating of 1500 in all four modes, but cannot improve it — there is simply no one to beat. Without online matchmaking the rating system, profile and friends (future specs) make no sense. The board from 003 is already ready as a component — all that remains is to feed it moves from the network instead of a second mouse.

**How we measure success:**

- From clicking "Find game" to seeing the board and clocks starting (with a matched opponent) during prime-time — **median no more than 10 seconds**, 95th percentile — **no more than 30 seconds**.
- Share of games that reach a natural conclusion (checkmate, stalemate, flag, resignation, draw) — **no less than 85%** (the rest are connection losses, abandonment on flag by an offline player, etc.).
- Deviation of a player's rating from their "true" level — **within ±50 ELO after 30 games** (metric from product-definition §1.4).
- Position divergence between two tabs of the same player after an opponent's move — **no more than 500 ms** (a move is not visible in one tab for longer than half a second).

---

## 2. Functional Requirements (The "What")

### 2.1 Access to matchmaking

- **As** a signed-in player, **I want** to enter an online game from the home page with a single click, **so that** I can quickly start a match against a live opponent.
  - On the home page a signed-in player sees a "Play online" block with four mode cards — **Bullet (1 min)**, **Blitz (3 min)**, **Rapid (10 min)**, **Classical (30 min)** — and a **"Find game"** button. Blitz is selected by default.
  - Next to the "Find game" button, the player's current rating in the selected mode is shown (for example, "Your rating: 1500").
  - On clicking "Find game" the player is taken to the `/play` page with the opponent-search screen.
  - If a guest (not signed in) lands on the home page, the "Play online" block is **not shown** to them: no mode cards, no "Find game" button. The guest sees only the hero (title, product description) and the CTA buttons "Sign in" / "Register". Matchmaking is a gated area; entry starts with signing into an account, not with simulating a mode selection.
  - If a guest navigates to `/play` directly (via a bookmark or link), they are redirected to the sign-in page with the message "Sign in to play online"; after a successful sign-in the player is automatically returned to the home page.
  - Hotseat (`/game` from spec 003) remains a separate page and is accessible to both guests and signed-in users — unchanged.
  - **Acceptance Criteria:**
    - [x] Given a signed-in player opened the home page, when the page has loaded, then they see a "Play online" block with four mode cards (Bullet/Blitz/Rapid/Classical) and a "Find game" button, with the "Blitz" card highlighted by default.
    - [x] Given a signed-in player is on the home page, when they look at the "Play online" block next to the "Find game" button, then they see their current rating in the selected mode (for example, "Your rating: 1500").
    - [x] Given a signed-in player selected the "Rapid" card, when they click "Find game", then they are taken to the `/play` page with the opponent-search screen in Rapid mode.
    - [x] Given a guest opened the home page, when the page has loaded, then they see only the hero with "Sign in" and "Register" buttons and do NOT see the "Play online" block, mode cards or "Find game" button.
    - [x] Given a guest navigates to `/play` directly, when the page loads, then they are redirected to the sign-in page with the message "Sign in to play online", and after a successful sign-in they are returned to the home page.

### 2.2 Opponent-search screen

- **As** a player searching for a match, **I want** to see that the system is searching for an opponent for me, **so that** I understand the process is ongoing and have the ability to cancel.
  - On the `/play` page in search mode the player sees: the heading "Looking for an opponent...", an indication of the selected mode and time control ("Blitz, 3 minutes"), their own rating in that mode, a timer "in queue: `MM:SS`", a short explanation of the pairing rules ("Looking for a player of similar rating. If no one is found within 10 seconds, we widen the range"), and a **"Cancel"** button.
  - Matchmaking finds an opponent whose rating is within **±100** of the player's rating. If no opponent is found within **10 seconds**, the range widens to **±200**, another 10 seconds later — to **±400**, and so on, doubling every 10 seconds until it becomes "any rating". Widening is automatic; the user does not control it.
  - Clicking "Cancel" removes the player from the queue and returns them to the home page. Any navigation away from the page (a header link, the browser's "Back" button) also removes the player from the search.
  - If the player closes the tab/browser during the search, they are automatically removed from the queue within 30 seconds (the time when the connection expires).
  - If the player is in the queue and a match arrives, they are dropped straight into the game with no intermediate confirmation dialog (autostart).
  - **Acceptance Criteria:**
    - [x] Given a player landed on `/play` after clicking "Find game" in Blitz mode, when the page has loaded, then they see the heading "Looking for an opponent...", the caption "Blitz, 3 minutes", their rating, the timer "in queue: 0:00", a short note about range widening and a "Cancel" button.
    - [x] Given a player is in the queue, when 5 seconds have passed, then the "in queue:" timer shows "0:05".
    - [x] Given a player has been in the queue for more than 10 seconds with no near-rating opponents available, when the 11th second passes, then the search range widens automatically (the user does not see an explicit widening step in the UI, but pairing continues with a larger tolerance).
    - [x] Given a player is in the queue, when they click "Cancel", then they return to the home page and the "Find game" button is visible again in the "Play online" block.
    - [x] Given a player is in the queue, when they close the browser tab, then within 30 seconds they are removed from the queue and are no longer offered to opponents.

### 2.3 Starting an online game

- **As** a player who has just been matched with an opponent, **I want** to be instantly at the board with running clocks, **so that** I can start playing immediately.
  - At the moment the system finds an opponent, the search screen is replaced with the game screen: the board in the starting position, two clocks with the time of the selected mode, the move-history panel (empty), an action panel, cards for both players (opponent's nickname + rating; player's own nickname + rating).
  - **Color is assigned randomly** — each player sees themselves at the bottom, with their pieces facing their own screen; unlike hotseat, in an online game the board is oriented "my pieces towards me".
  - The first move is White's; White's clock starts ticking immediately, Black's clock is stopped.
  - The opponent's card is always on top, the player's own card is at the bottom (for both — both of them see the opponent on top).
  - The transition from the search screen into the game happens **instantly** and without "Accept match" dialogs — the player sees the board straight away.
  - **Acceptance Criteria:**
    - [x] Given a player is in the Blitz queue, when matchmaking finds them an opponent, then the search screen is immediately replaced with the game screen: board in the starting position, 3:00 clocks on both sides, empty history panel, cards for both players (nickname + rating).
    - [x] Given a player received the "white" color, when they look at the game screen, then they see white pieces in the lower half of the board and the opponent's pieces in the upper half; White's clock is ticking, Black's clock is stopped.
    - [x] Given a player received the "black" color, when they look at the game screen, then they see black pieces in the lower half of the board and white in the upper half; White's clock is ticking (on the opponent's side), Black's clock is stopped.
    - [x] Given both players just received "match found", when both look at their screens, then each sees the opponent's card on top with their nickname and rating, and their own card at the bottom.

### 2.4 Making a move in an online game

- **As** a player in an online game, **I want** to make moves and immediately see my opponent's moves, **so that** the game runs in real time.
  - Rules, highlights, piece choice on promotion, dialogs — are the same as on the hotseat board from spec 003 (all chess rules including castling, en passant, promotion; highlighting of possible moves and the last move; coordinates on the edges; click or drag-and-drop).
  - The player can only make a move **when it is their turn**; if they click their piece on the opponent's move, the possible-moves highlight does not appear.
  - After the player makes a move, their move **within no more than 500 ms** appears on the opponent's board; the "from" and "to" squares are highlighted as the last move for both players.
  - If for some reason the move cannot be delivered to the server (a brief connection drop), the piece returns to its starting square, a short message "Connection lost. Reconnecting..." appears; as soon as the connection is restored the message disappears and the player may retry the move (unless their flag has already fallen).
  - The board in an online game does NOT flip during play — each player sees it from their own side for the whole game.
  - **Acceptance Criteria:**
    - [x] Given a player is playing white and it is their turn, when they click the e2 pawn, then squares e3 and e4 are highlighted as possible moves.
    - [x] Given a player is playing white but it is Black's turn, when they click their e2 pawn, then no possible-moves highlighting appears and no move is made.
    - [x] Given the white player makes the move e2-e4, when the move is complete, then no later than 500 ms the black player sees the pawn on e4, the e2 and e4 squares highlighted as the last move, White's clock stops, Black's clock starts ticking, and the entry "1. e4" appears in the move history in both tabs.
    - [x] Given a player tries to make a move during a brief connection drop, when the move cannot be delivered to the server, then the piece returns to its starting square and the player sees the message "Connection lost. Reconnecting...".
    - [x] Given the white player is playing an online game, when their white pawn reaches the eighth rank, then the piece-choice dialog opens for them (queen by default) exactly as in hotseat, and the opponent sees the corresponding newly promoted piece on the board immediately after the choice.

### 2.5 Clocks and disconnect handling

- **As** a player, **I want** honest clocks that keep running even if the connection is lost, **so that** the game cannot be "paused" by leaving the site.
  - Clocks are displayed and behave as in hotseat (switching after a move, tenth-of-a-second precision under 10 seconds, coral color under 10 seconds, flag fall = loss or draw by insufficient material — see 003).
  - If a player loses connection, **their clock keeps ticking on the server** — a connection loss does not pause the game.
  - While a player is offline, the opponent sees a small "Opponent offline" indicator in the player's card (for example, a grey dot next to the nickname instead of a green one).
  - If the player returns to the game (reopens the tab, restores connection) **before their flag falls**, they immediately see the current position, the current clocks and can continue playing. The opponent's "offline" indicator disappears.
  - If the player's flag falls while they were offline, the game ends exactly as in hotseat: "Opponent wins. Flag." or "Draw. Opponent has insufficient material." (see 003.2.3). The result screen appears for both players when the online one returns — they immediately see that they have already lost on time.
  - **Acceptance Criteria:**
    - [x] Given an online game is in progress, white has moved, black has disconnected from the network, when 10 seconds of real time pass, then in the final state on both players' clocks black's time is reduced by exactly 10 seconds.
    - [x] Given a player is in an online game, when their opponent loses connection, then an "offline" indicator (grey dot) appears next to the opponent's nickname.
    - [x] Given a player has disconnected from the network, their clock keeps ticking on the server, when they return to the `/play` page before their flag falls, then they see the current position on the board, the current reading of their clock (less than it was when they left) and can make their move.
    - [x] Given a player is offline, their clock shows 0.0 (flag fallen), the opponent has sufficient material to mate, when the player returns to `/play`, then they immediately see the result screen "You lost. Flag.".
    - [x] Given a player is offline, their clock shows 0.0, the opponent has only a king on the board, when the player returns to `/play`, then they immediately see the result screen "Draw. Opponent has insufficient material.".

### 2.6 Synchronization between tabs of the same player

- **As** a player who opened a game in one tab, **I want** to be able to open the same game in a second tab, **so that** I can play/watch the position from two screens.
  - If a player who is already in an online game opens `/play` in a second tab of the same browser, in that tab they see **the same active game** — the same board, the same clocks, the same move history, cards for both players.
  - A move made in one tab (clicking a square, dragging a piece, confirming promotion, clicking "Resign", etc.) is immediately reflected in all other tabs of the same player — no later than 500 ms. This applies to the entire scene: board position, clocks, move history, open dialogs (promotion, resignation, draw offer), result screen.
  - If a player opens two tabs with `/play` and no game is in progress in either, both tabs show the mode-selection/search screen identically; clicking "Find game" in one puts the player into the queue — the second tab also shows the search screen, the same timer and the same "Cancel" button.
  - The player **does not double their place in the queue**, even if they opened two tabs — one user action corresponds to one entry into the queue.
  - When the game ends, the result screen appears in all tabs simultaneously.
  - **Acceptance Criteria:**
    - [x] Given a player is playing an online game in one tab, when they open `/play` in a second tab of the same browser, then the second tab shows the same current position on the board, the same clocks and the same move history as the first.
    - [x] Given a player is playing a game and keeps it open in two tabs, when they make a move in the first tab, then in the second tab they see this move, the updated history and the clock switch no later than 500 ms.
    - [x] Given a player is in the search queue in two tabs at once, when matchmaking finds an opponent, then both tabs simultaneously show the game screen with one and the same game.
    - [x] Given a player is queued in two tabs, when the opponent on the other end looks at their own queue, then they see one (not two) potential opponents from this player.
    - [x] Given a player is playing a game in two tabs, when the game ends (checkmate), then the result screen appears in both tabs simultaneously.

### 2.7 Resign and offer draw in an online game

- **As** a player, **I want** to resign or offer a draw, **so that** I can finish a game that clearly isn't going well.
  - Below the board there are two buttons: **"Resign"** and **"Offer draw"**. Button logic is as in 003, with one difference: a draw offer **waits for the opponent's response**.
  - **Resign.** Click "Resign" → dialog "Resign as `white/black`? Cancel / Resign". Clicking "Resign" in the dialog → the game ends immediately for both players with the result "White/Black resigned. Opponent wins.". The loser's rating goes down, the opponent's goes up (see 2.8).
  - **Offer draw.** Click "Offer draw" → a banner/modal "Opponent offers a draw" appears on the opponent's screen with buttons "Decline" and "Accept"; the one who offered sees the caption "Offer sent" next to the "Offer draw" button. If the opponent accepts, the game ends with "Draw. By agreement.". If they decline, the offerer sees a brief message "Draw offer declined" and the game continues.
  - Between draw offers from the same player there must be at least **10 moves** (counting only their own moves, i.e. half-moves of this player) so the opponent is not spammed. If an attempt is made to offer a draw earlier, the "Offer draw" button shows the hint "You can offer a draw again in `N` of your moves".
  - While a draw offer is pending and the player it was sent to has not responded, the clock keeps ticking for the side whose turn it is.
  - **Acceptance Criteria:**
    - [x] Given an online game is in progress, the player is playing white, when they click "Resign" and confirm "Resign" in the dialog, then the game ends immediately for both players with the result screen "White resigned. Black wins.".
    - [x] Given an online game is in progress, when the white player clicks "Offer draw", then a banner "Opponent offers a draw" with "Decline" and "Accept" buttons appears on the black player's screen, and next to the "Offer draw" button the white player sees the caption "Offer sent".
    - [x] Given the white player offered a draw, when the black player clicks "Accept", then the game ends for both with the result screen "Draw. By agreement.".
    - [x] Given the white player offered a draw, when the black player clicks "Decline", then white sees a brief message "Draw offer declined" on screen, the banner for black disappears, the game continues, and the clock for the side whose turn it is keeps ticking.
    - [x] Given the white player just offered a draw which was declined, when white tries to click "Offer draw" earlier than 10 of their own moves later, then the button hints "You can offer a draw again in `N` of your moves" and no offer is sent.

### 2.8 Rating recalculation after a game

- **As** a player, **I want** to see how my rating changed after a game, **so that** I understand my progress.
  - When a game ends (for any reason: checkmate, stalemate, flag, insufficient material, threefold repetition, 50-move rule, resignation, draw by agreement) the rating of both players in the current mode is recalculated.
  - The direction of change is always predictable:
    - **Winner** — rating goes up. The higher the loser's rating relative to the winner's, the larger the increase.
    - **Loser** — rating goes down. The lower the winner's rating relative to the loser's, the larger the drop.
    - **Draw** — the player with the higher rating loses a little, the player with the lower rating gains a little. If the ratings are equal, nothing changes for either.
  - The number of games played by the player in the current mode is incremented by 1 after the game.
  - The **classical ELO formula** is used: while a player has played fewer than 30 games in the given mode, their K-factor is **32** (fast calibration for newcomers); after 30 games K drops to **16**. At equal ratings 1500 vs 1500 this gives a delta of "±16" for a win/loss (while K=32); a difference in ratings decreases/increases the delta as expected (an unexpected win → a large change, an expected win → a small one).
  - **Acceptance Criteria:**
    - [x] Given a player with rating 1500 (Blitz, 0 games) won an online Blitz game against an opponent with rating 1500 (0 games), when the game ended, then their rating in Blitz went up, the opponent's rating went down, and both have their Blitz game count at 1.
    - [x] Given a player with rating 1500 finished a game with an equal-rated opponent by draw by agreement, when they look at their profile, then their rating in that mode is still 1500 and the game count is incremented by 1.
    - [x] Given an online game is in progress, when it ends for any reason (checkmate / stalemate / flag / resignation / draw / insufficient material / threefold repetition / 50 moves), then for both players the rating in the current mode is recalculated and the game count is incremented by exactly 1.

### 2.9 Result screen and rematch

- **As** a player whose game has just ended, **I want** to see the result, the rating change, and quickly offer a rematch, **so that** I can keep playing without going back to the home page.
  - When the game ends, a modal result screen appears over the board for both players. On it: a **result title** (for example, "White wins. Checkmate.", "Draw. By agreement.", "You lost. Flag." — the text is from the viewer's perspective), a **subtitle** (a short reason, for example "Black has no moves left"), the **player's rating change** in the current mode in the format "Rating: 1500 → 1516 (+16)" or "1500 → 1484 (−16)", three buttons: **"Rematch"**, **"New game"**, **"Close"**.
  - **"Rematch"** sends the opponent an offer. On the opponent's result screen an indicator "Opponent offers a rematch" appears along with an extra button **"Accept rematch"** (their "Rematch" button turns into "Accept rematch", or an indicator appears next to it — design's choice). If the opponent accepts, both sides immediately start a new game in **the same mode**, with **swapped colors** (whoever was white becomes black); on the same result screen the modal is replaced with the game view.
  - If the opponent has not clicked "Rematch" within **30 seconds** or clicked "Close" / "New game", the rematch offer expires — the initiator sees "Opponent didn't respond" next to the "Rematch" button.
  - **"New game"** closes the modal and returns the player to the home page — to the "Play online" block with the "Find game" button. The mode selection is preserved from the previous game.
  - **"Close"** closes the modal, leaves the final position visible, clocks stopped, "Resign" / "Offer draw" buttons hidden. The player can review the position.
  - **Acceptance Criteria:**
    - [x] Given an online game between two players with rating 1500 (fewer than 30 games each) ended with White's checkmate, when the result screen appears for the white player, then the title is "You won. Checkmate.", the rating change is visible in the format "1500 → 1516 (+16)" and there are three buttons "Rematch", "New game", "Close".
    - [x] Given an online game between two players with rating 1500 (fewer than 30 games each) ended with White's checkmate, when the result screen appears for the black player, then the title is "You lost. Checkmate.", the rating change is visible in the format "1500 → 1484 (−16)" and the same three buttons.
    - [x] Given the result screen is open for the white player, when they click "Rematch", then on the black player's result screen an "Opponent offers a rematch" indicator and an "Accept rematch" button appear.
    - [x] Given white offered a rematch, when black clicks "Accept rematch", then for both the result modal closes and a new game starts instantly in the same mode, but the player who was black in the previous game now plays white.
    - [x] Given white offered a rematch, when black does not respond within 30 seconds, then white sees the caption "Opponent didn't respond" next to the "Rematch" button.
    - [x] Given the result screen is open, when the player clicks "New game", then the modal closes, the player is returned to the home page with the "Play online" block, and the selected mode is the one from the just-played game.
    - [x] Given the result screen is open, when the player clicks "Close", then the modal closes, the board with the final position stays visible, the clocks are stopped, and the "Resign" and "Offer draw" buttons are hidden.

---

## 3. Scope and Boundaries

### In-Scope

- The `/play` page with an online game between two humans.
- Opponent search in a rating-based queue in the selected mode (Bullet / Blitz / Rapid / Classical — the same four as in 003).
- Automatic widening of the rating range as waiting time grows (±100 → ±200 → ±400 → … → ∞).
- Autostart of a game immediately upon finding an opponent (no "Accept match" dialog).
- Reuse of the board, rules, clocks, highlighting, promotion dialog and result screen from 003 — with an online source of moves.
- Board oriented with the player's own pieces towards themselves (flipped for the black player), unlike hotseat.
- Clocks keep running even if the player disconnects; return to the game before the flag falls.
- "Opponent offline" indicator on the opponent's card.
- Synchronization between multiple tabs of the same player: the same game in both, a move visible everywhere, a single place in the queue.
- Resign and offer draw online (draw — through opponent's response, limit "no more than once per 10 of your own moves").
- Rating recalculation in the corresponding mode after each online game.
- Result screen with rating change, "Rematch" button (with a 30-second window for the opponent's response) and swapped colors on rematch acceptance.
- Access to matchmaking — only for signed-in players. Guest → redirect to sign-in.

### Out-of-Scope

- Hotseat — stays in its own spec 003, is not changed in any way.
- Game against a bot — a separate spec.
- Friends, challenging a friend to a game directly — a separate spec.
- Public list of active games, leaderboard, spectator mode (watching others' games) — not in MVP.
- Chat during a game — not in MVP (deferred to a separate task).
- Saving games to a player's history (list of past games, replay by moves, PGN/FEN export) — a separate spec.
- Game analysis after completion (arrows, computer position evaluation) — not in MVP.
- Tournaments, leagues — not in MVP.
- Chess variants (Chess960, etc.) — not in MVP.
- Clock increments (Fischer / Bronstein) — only the basic control as in 003.
- Anti-cheat — not in MVP.
- Rejecting a match ("I don't want to play specifically this player") — not in MVP; widening the queue range does not imply a manual opponent filter.
- Reopening a game in a different browser / device (not in the same tab session) after a connection loss — in MVP it is enough for the player to come back to the same browser; universal multi-device is left for separate work.

---

## Change Log

- [2026-10-10] — observation during post-verify walkthrough: a guest on the home page was shown mode cards + the "Find game" button (clicking led to /login with a banner), which created the illusion of accessible matchmaking — Changed §2.1: the "Play online" block is no longer displayed to a guest. On the home page a guest sees only the hero with CTA "Sign in" / "Register". A direct visit to `/play` still redirects a guest to /login with the message "Sign in to play online". One acceptance criterion was replaced with two new ones (reset to `[ ]` until re-implemented).
