# Functional Specification: Play vs bot (Stockfish)

- **Topic:** A single-player training game against a chess bot with a choice of difficulty level, color and time control. Games don't affect rating and aren't saved to history.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Right now on YanChess you can only play hotseat or online against a live opponent. Online matchmaking depends on there being someone in a queue of comparable rating — outside prime time the wait stretches out, and a newcomer may be psychologically afraid of their first game against a live person. This feature closes the single-player training use case from `product-definition.md` §2.1: "Game against a bot — several difficulty levels for practice and offline-mode play".

**The problem we are solving:**
- For **Mike the amateur**: sometimes you simply don't feel like playing a human — you want to practice an opening, work on an endgame without worrying about an opponent flagging out.
- For **Anna the club player**: you need a bot of a specific strength (1800+) to prepare for tournaments and work on specific weaknesses.
- For **any new player**: a first game on the platform without the fear of losing rating or facing an aggressive opponent. The North Star of "≤10s to the first game" is delivered via the bot without depending on a queue.

**How we measure success:**

- From clicking "Play vs bot" to seeing a board with started clocks — **no more than 2 seconds** on a typical laptop.
- From the player's move to the bot's reply move — **no more than 1 second** on levels 800–1500, **no more than 3 seconds** on levels 1800–2100 (the bot spends a reasonable amount of time calculating in proportion to its strength).
- The bot's strength matches the declared level: games against a 1500-level bot played by a player with a rating of 1500 average **~50% wins** (±10% margin) over a control sample of 20 games.

---

## 2. Functional Requirements (The "What")

### 2.1 Access to the game vs bot

- **As** any user (guest or signed in), **I want** to be able to play against a bot from the home page or from the header, **so that** I can start training immediately without depending on matchmaking or an account.
  - In the app header (for all users — guest and signed in) next to the existing "Play" link (hotseat `/game`) there appears a second link — **"Vs bot"**, leading to the `/vs-bot` page.
  - On the home page of a signed-in player, next to the "Play online" block, a second block appears — **"Play vs bot"** with a short button linking to `/vs-bot` (exact visual look up to the designer; button text: "Play vs bot"). We don't show the "Play vs bot" block on the guest's home page — a guest reaches the bot through the header.
  - The `/vs-bot` page is accessible to everyone — no `/login` redirect, no verified-email requirement.
  - Hotseat (`/game`) and online matchmaking (`/play`) are not affected.
  - **Acceptance Criteria:**
    - [x] Given a guest opened the home page, when they look at the header, then they see two game links: "Play" (hotseat) and "Vs bot" (vs-bot).
    - [x] Given a guest or a signed-in player followed the "Vs bot" link, when the `/vs-bot` page has loaded, then they see the game-setup screen (no redirect to `/login`, no error).
    - [x] Given a signed-in player opened the home page, when they look at the page, then they see both blocks — "Play online" and "Play vs bot" — with a "Play vs bot" button-link leading to `/vs-bot`.

### 2.2 Game-setup screen

- **As** a player, **I want** to choose the bot's difficulty level, my color and time control, **so that** the game matches my training goals.
  - On the `/vs-bot` page before game start the player sees a setup screen with four blocks:
    1. **Bot difficulty level** — five cards in ascending order:
       - **Beginner** — target rating **800** ("just learning the rules")
       - **Amateur** — **1200** ("plays occasionally, knows the basic schemes")
       - **Club Player** — **1500** ("an average active player")
       - **Strong** — **1800** ("an experienced club player")
       - **Expert** — **2100** ("candidate master")

       Each card has a name, a caption with the target rating (for example "1500 ELO") and a short description. By default **Club Player (1500)** is selected.
    2. **Color** — three options: **White**, **Black**, **Random**. Default — **White**.
    3. **Time control** — four mode cards from spec 003/004: **Bullet (1 min)**, **Blitz (3 min)**, **Rapid (10 min)**, **Classical (30 min)**. Default — **Blitz**.
    4. **"Start game"** button — large, below all selection blocks.
  - Selected settings are remembered at the session level (navigating away and back doesn't reset the values). A full page reload returns all values to defaults — this is a deliberate trade-off: the game and the settings aren't persisted; training starts from a clean slate.
  - **Acceptance Criteria:**
    - [x] Given a player opened `/vs-bot`, when the page has loaded, then they see four setup blocks (level, color, time control, "Start game" button), with "Club Player (1500)", "White" and "Blitz" selected by default.
    - [x] Given a player is on the setup screen, when they click the "Expert" card, then the "Expert" card becomes highlighted, the other levels are not.
    - [x] Given a player is on the setup screen, when they click "Random" in the color block, then the "Random" option becomes highlighted, "White" and "Black" are not; on game start the player's color is determined by a coin flip.
    - [x] Given a player is on the setup screen, when they choose Rapid and click "Start game", then the setup screen is replaced with the game screen with 10:00 clocks on both sides.

### 2.3 Starting a game vs bot

- **As** a player who clicked "Start game", **I want** to be instantly at the board, **so that** I can start playing immediately.
  - On clicking "Start game" the setup screen is replaced with the game screen: board in the starting position, two clocks with the time of the selected mode, move-history panel (empty), action panel, side cards. The top card shows **the bot's name in the format "Bot <level name> (<ELO>)"**, for example "Bot Club Player (1500)". The bottom card shows the player's own nickname (for signed-in users) or **"Guest"** (for anonymous users).
  - **Board orientation:** the player at the bottom, with their pieces facing them. If the player plays black, the board is flipped — black pieces at the bottom, white at the top.
  - The first move is White's. White's clock starts ticking immediately, Black's clock is stopped.
  - If the player chose to play **Black** — the bot moves first. The delay from the board appearing to the bot's first move is no more than **1 second**, regardless of level, so as not to create a feeling of "freezing".
  - **Acceptance Criteria:**
    - [x] Given a player chose Club Player + White + Blitz and clicked "Start game", when the game screen appeared, then they see the board in the starting position (white pieces at the bottom), 3:00 clocks on both sides, empty move history, a "Bot Club Player (1500)" card on top, their own card at the bottom; White's clock is ticking, Black's clock is stopped.
    - [x] Given a player chose Club Player + Black + Blitz and clicked "Start game", when the game screen appeared, then they see the board in the starting position (black pieces at the bottom — the board is flipped), 3:00 clocks on both sides; **within no more than 1 second** the bot makes the first move, Black's clock starts ticking.
    - [x] Given a player chose Random and clicked "Start game", when the game screen appeared, then they play either white or black (randomly); the board orientation and the bot's first move (if the player is black) match the chosen color.

### 2.4 Making a move and the bot's response

- **As** a player in a game vs bot, **I want** to make moves and see sensible bot responses, **so that** the game follows the rules and has training value.
  - Rules, highlights, piece choice on promotion, dialogs — are the same as on the hotseat board (spec 003) and in the online game (spec 004). Reusable board.
  - The player can make a move **only when it is their turn**. Clicking their piece on the bot's move produces no highlighting.
  - After the player's move the bot starts "thinking" and within a reasonable time (see §1 "How we measure success") makes a reply move. While the bot is thinking, for the player:
    - the bot's clock is ticking (this is its thinking time — same as a human's)
    - the "Resign" button remains active
    - optionally the bot's card shows a "thinking..." indicator (exact format up to the designer)
  - The bot plays at the strength of the chosen level: it makes more mistakes on low levels (800/1200), plays more precisely on high levels (1800/2100). The exact mechanism for setting the strength is technical (`UCI_Elo` in Stockfish) and is not fixed in this spec.
  - **Acceptance Criteria:**
    - [x] Given a player is playing white, when they make the move e2-e4, then within no more than 1 second (for levels 800–1500) the bot replies with its move, the player's clock stops and the bot's clock starts ticking → then the bot's clock stops and the player's resumes.
    - [x] Given a player is playing black at the Expert level, when they make a move in response to the bot's first move, then the bot replies within no more than 3 seconds, the clocks switch correctly.
    - [x] Given a game vs bot is in progress, when the player tries to click their piece during the bot's move, then no highlighting of possible moves appears and no move is made.
    - [x] Given a player plays Club Player level 20 games in a row with a rating close to 1500 (a manual test in CI is not required — a manual control sample at the verification stage), when we count the result, then the player's win percentage is within 40–60% (a bot of comparable strength).

### 2.5 Clocks

- **As** a player, **I want** the same clocks as in an online game, **so that** I get used to playing on time.
  - Clocks display and behave as in hotseat (spec 003): switch after a move, tenth-of-a-second precision under 10 seconds, coral color under 10 seconds, flag fall = loss (or a draw by insufficient material if the bot has only a king).
  - Specifics of a game vs bot: the clock is local (client-side), the bot is a local source of moves. There is no server imposing authoritative time. This model is acceptable because the game is a training one and does not affect rating.
  - If the player's flag falls: the result screen shows "You lost. Flag." (or "Draw. Bot has insufficient material." if the bot has only a king).
  - If the bot's flag falls: the result screen "You won. Flag.".
  - **Acceptance Criteria:**
    - [x] Given a game vs bot is in progress in Blitz, when the player looks at the clocks, then they see "3:00" for themselves and "3:00" for the bot at the start of the game.
    - [x] Given a game is in progress, the player made a move, when a second has passed, then the player's clock is unchanged, the bot's clock has decreased by one second.
    - [x] Given a Bullet game is in progress, the player's clock is 0.0 (flag fallen), the bot has a queen on the board, when the player's clock reaches zero, then the game ends, the screen "You lost. Flag." appears.

### 2.6 Player actions: resign (but not offer draw)

- **As** a player, **I want** to be able to resign in a hopeless position, **so that** I don't have to play on to mate.
  - Below the board there is only one action button: **"Resign"**. The "Offer draw" button is **hidden** — offering a bot a draw is meaningless; it can't "accept" one (there's no evaluation mechanism, and simulating it is more complex than needed for MVP).
  - Clicking "Resign" → confirmation dialog "Resign? Cancel / Resign". Choosing "Resign" → the game ends with the result "You resigned. Bot wins.".
  - Draws happen **only by board rules**: stalemate, insufficient material, threefold repetition, 50-move rule. Agreement is unavailable.
  - **Acceptance Criteria:**
    - [x] Given a game vs bot is in progress, when the player looks at the action panel below the board, then they see the "Resign" button and do NOT see the "Offer draw" button.
    - [x] Given a player is playing vs bot, when they click "Resign" and confirm in the dialog, then the game ends, the result screen "You resigned. Bot wins." appears.
    - [x] Given a game is in progress, when stalemate occurs (the opponent has no legal moves, the king is not in check), then the game ends in a draw "Draw. Stalemate.".

### 2.7 Result screen and rematch

- **As** a player after a game, **I want** to see the outcome and quickly start a rematch, **so that** I can continue training without returning to the settings.
  - When the game ends (for any reason: checkmate, stalemate, flag, insufficient material, threefold repetition, 50-move rule, resignation) a modal result screen appears over the board with:
    - **result title** from the player's perspective — "You won. Checkmate.", "You lost. Flag.", "Draw. Stalemate.", etc.
    - **subtitle** — short reason/context
    - three buttons: **"Rematch"**, **"New game"**, **"Close"**
  - **"Rematch"** — a new game begins instantly: same bot level, same time control, **color changes** (whoever was white becomes black). If the player was on "Random" — color is flipped by coin again. There is no confirmation dialog (the bot doesn't need to agree).
  - **"New game"** — closes the modal and returns to the `/vs-bot` setup screen with the same selected settings (so you can change the level if you want).
  - **"Close"** — closes the modal, leaves the final position visible; clocks stopped, the "Resign" button hidden. You can review the position (purely visually; an analysis mode with move navigation is not part of MVP).
  - **Acceptance Criteria:**
    - [x] Given the player checkmated the bot in a game vs bot, when the result modal appears, then the title is "You won. Checkmate.", three buttons "Rematch", "New game", "Close" are visible.
    - [x] Given the player was playing white and finished the game, when they click "Rematch", then the modal closes, a new game starts instantly at the same level and time control, but the player now plays **black** (color swapped).
    - [x] Given the player was playing vs bot and the game ended, when they click "New game", then the modal closes, they return to the `/vs-bot` setup screen, the level / color / time-control choices are preserved from the previous game.
    - [x] Given the result modal is open, when the player clicks "Close", then the modal closes, the board with the final position stays visible, the clocks are stopped, the "Resign" button is hidden.

### 2.8 Games don't affect rating and aren't saved to history

- **As** a player, **I want** to experiment calmly with the bot, **so that** losses don't cost me rating.
  - Games vs bot **never change** the player's ratings in `RatingByMode`. Regardless of the result and the bot's level — ratings stay as they were.
  - Games vs bot are **not saved to the `games` table**. In the player's history (which will appear in a separate spec) there will be no bot games.
  - On the result screen, unlike in an online game, **the "Rating: X → Y (±Δ)" line is NOT shown** — precisely because the rating did not change.
  - **Acceptance Criteria:**
    - [x] Given a signed-in player with a Blitz rating of 1500 played a game vs Expert bot (2100) and lost, when they open their profile, then their Blitz rating is still 1500, the number of Blitz games played is unchanged.
    - [x] Given a player finished a game vs bot, when the result screen appears, then they do NOT see the "Rating: X → Y (…)" line — it simply isn't there.

### 2.9 Behavior on page reload and navigation

- **As** a player, **I want** to understand what happens to the game if I accidentally reload or leave the page, **so that** there are no surprises.
  - A game vs bot **lives only in the current tab**, is not persisted on the server or in localStorage. On a full `/vs-bot` reload (F5, Ctrl+R, direct URL navigation) the active game is dropped, the player sees the setup screen again.
  - On navigating away from the page (clicking a header link, the browser's "Back" button) in the middle of a game — the game is dropped without a confirmation dialog. This is a deliberate trade-off: a training game isn't worth catching a `beforeunload` dialog for in MVP.
  - **Acceptance Criteria:**
    - [x] Given a player is playing a game vs bot in the thick of things (clock at 1:30, 10 moves made), when they press F5 and confirm the reload, then after loading they see the `/vs-bot` setup screen in its initial state (with no option to resume the game).
    - [x] Given a player is playing a game vs bot, when they follow a header link to "Online" or "Hotseat", then the game is dropped; on returning to `/vs-bot` they again see the setup screen.

---

## 3. Scope and Boundaries

### In-Scope

- A separate `/vs-bot` page for training games against a bot.
- A "Vs bot" link in the header for all users (guest + signed in); a "Play vs bot" block on the home page only for signed-in users.
- Setup screen: 5 bot levels (Beginner/Amateur/Club Player/Strong/Expert — tied to ELO targets 800/1200/1500/1800/2100), color choice (White/Black/Random), 4 time controls (Bullet/Blitz/Rapid/Classical), "Start game" button.
- Reuse of the board, clocks, rules, highlights, promotion dialog from spec 003 (hotseat). Reuse of the shared `GameViewModel` components from spec 004.
- Board is flipped when the player plays black. The bot moves first if the player is black (with a delay ≤1s).
- "Resign" button with confirmation. "Offer draw" button hidden.
- All automatic game endings by board rules (checkmate, stalemate, insufficient material, threefold, 50 moves, flag — accounting for "bot has insufficient material").
- Result screen with the player's perspective and three buttons: Rematch (swap color), New game (back to settings), Close (freeze board).
- A game vs bot lives only in the current tab. Reload / navigate away — the game is lost, no confirmation dialog.
- A game vs bot **does not change** rating and **is not written** to the `games` table.

### Out-of-Scope

- Matchmaking against a human — a separate spec 004.
- Hotseat — a separate spec 003, not affected.
- Persisting a game vs bot (reconnect, cross-tab, continuation after closing the browser) — not in MVP; rounds are short, the game is a training one.
- Saving bot games in the player's history — not in MVP; when a common "History" section appears (a separate spec) it can be revisited.
- Game analysis after completion (move navigation, arrows, Stockfish evaluation as an arbiter) — not in MVP, may appear in a separate "Analysis" spec later.
- Choosing an opening / starting position by FEN / loading a position from PGN — not in MVP.
- Offering a draw to the bot or simulating a bot's draw offer — not in MVP.
- Chat, bot hints ("best move"), automatic takeback, "takeback" — not in MVP.
- Rethinking the rating system for bot games (training rating, achievements, "star" levels) — not in MVP.
- Clock-increment presets (Fischer / Bronstein) — in MVP only the basic control, as in 003/004.
- Multiple simultaneous games vs bot (multi-board) — not in MVP.
- Personal bot settings (style "tactical / positional", "aggressive / defensive") — not in MVP; the level is determined only by an ELO target.
- Engine choice (alternatives to Stockfish) — Stockfish is fixed as in architecture.md §1.

---

## Change Log

_No amendments yet._
