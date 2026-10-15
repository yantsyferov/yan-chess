# Functional Specification: Game board (hotseat)

- **Topic:** A chess board with a full rules engine, clocks, move history, and end-of-game screen — in hotseat mode (two players take turns in the same browser)
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Right now on YanChess you can only register and open the profile — there is nowhere to play. This feature covers the very core of the product: a board where pieces move by the rules, clocks that tick, a move history, and a game result screen.

The intentional scope for the first version is **hotseat** (two players take turns in the same browser). This lets us build and test the whole game mechanic (rules, clocks, pawn promotion, checkmate, stalemate, draw, flag, resignation) **before** we tackle matchmaking and online synchronization (a separate spec) and the bot game (a separate spec). Both subsequent features will reuse this board as a component — all they will need to do is supply the move source (a socket channel or a UCI engine) instead of "let the second player click".

**Problem we are solving:** without a board, the product is just a registration page. Any player who comes to YanChess expects to be able to make a first move. This feature delivers that — even if just "for both sides", but with a fully working rules engine and clocks. After this, matchmaking and the bot plug in quickly.

**How we measure success:**

- The board correctly handles **all standard chess rules** (including castling in both directions, en passant, pawn promotion with piece choice, checkmate, stalemate, draw by insufficient material, threefold repetition, 50-move rule) — verified by automated tests and a couple of control games from classical play.
- From the click of "Start game" to the appearance of the board and the start of the clocks — **no more than 500 ms** on a regular laptop.
- Over one full Bullet (1 minute) game the clocks neither lag nor race ahead of the reference by more than **100 ms total per game**.

---

## 2. Functional Requirements (The "What")

### 2.1 Mode selection and starting a game

- **As** a player, **I want** to pick a mode and start a game, **so that** I can play with the right time control.
  - On page `/game`, at the top, there is a mode selection block: four cards — **Bullet (1 min)**, **Blitz (3 min)**, **Rapid (10 min)**, **Classical (30 min)**. Bullet is selected by default.
  - Below the cards — the "Start game" button.
  - On click of "Start game" the mode selection block is hidden, the board appears, two clocks (black on top, white at the bottom) are shown with the time of the chosen mode, a move history panel on the right, and an action panel below. White moves first; their clock starts ticking.
  - **Acceptance Criteria:**
    - [x] Given the player opened the page `/game`, when the page loaded, then they see the page title, four mode cards (Bullet/Blitz/Rapid/Classical) with the time shown, the "Start game" button, and no board yet.
    - [x] Given the player is on `/game`, when they click the "Blitz" card, then the "Blitz" card becomes highlighted (visually marked as active), the other modes are not.
    - [x] Given the player is on `/game` and chose Blitz, when they press "Start game", then the mode selection block disappears, the board appears in the starting position, both clocks show 3:00 each, the move history panel (empty) and the action panel are visible; white's clock is running, black's clock is paused.
    - [x] Given the player started a game, when they look at the board, then white pieces are at the bottom, black pieces at the top (as when playing white); coordinates (a-h at the bottom, 1-8 on the side) are visible.

### 2.2 Moves by the rules of chess

- **As** a player, **I want** to move any legal piece by click or drag, **so that** the game runs by the rules.
  - A click on your piece highlights all squares it can move to (including captures and special moves — castling, en passant). A second click on the piece clears the highlight.
  - A click on a highlighted square makes the move. Alternatively, the player drags the piece onto the target square (drag-and-drop).
  - You cannot move a piece of the opposite color, a piece that would expose its own king to check, or to a square the piece cannot move to.
  - You cannot make a move that leaves your own king in check.
  - **Special rules are mandatory:**
    - Short and long castling — a single move of the king two squares; the rook moves itself.
    - En passant — offered only immediately after the opponent's double pawn move.
    - Pawn promotion — upon reaching the eighth rank a modal dialog opens with four icons (queen, rook, bishop, knight); the player chooses which piece appears. Queen is selected by default; pressing Enter confirms it.
  - After every move the last move is highlighted on the board (both the "from" square and the "to" square).
  - During the game the board does NOT flip — white is always at the bottom (hotseat limitation; the opponent reaches over to the board by hand).
  - **Acceptance Criteria:**
    - [x] Given the player started a game and it's time for white pawns to move, when the player clicks the e2 pawn, then e3 and e4 are highlighted as legal moves.
    - [x] Given the white player selected the e2 pawn and sees e3 and e4 highlighted, when they click the e4 square, then the pawn moves from e2 to e4, the highlights are removed, the move history gets a "1. e4" entry, white's clock stops, and black's clock starts running.
    - [x] Given the game is in progress, when the player tries to move their piece to a square where this move would leave their king in check, then the move is not made and the piece returns to the original square.
    - [x] Given the game is in progress and white can short-castle (king and rook haven't moved, squares f1 and g1 are empty, the king is not in check and doesn't pass through an attacked square), when the white player clicks the king on e1 and then the g1 square, then the king lands on g1, the rook on f1 (the move is counted as castling), and the move history shows "O-O".
    - [x] Given a white pawn is on e5 and black just played d7-d5 on the previous move, when the white player clicks the e5 pawn and then the d6 square, then the white pawn moves to d6, the black pawn on d5 is removed from the board (en passant capture), and the move history shows "exd6".
    - [x] Given a white pawn on the seventh rank is about to promote, when the player moves it to the eighth rank, then a dialog with four pieces opens with the queen selected by default.
    - [x] Given the pawn promotion dialog is open, when the player clicks the rook icon, then a rook appears on the square, the dialog closes, the move is counted, and the history shows the corresponding entry (for example "e8=R").
    - [x] Given the player just made a move, when they look at the board, then the square the piece left from and the square it moved to are visually highlighted (in a different shade from the regular selection).

### 2.3 Chess clocks

- **As** a player, **I want** to see how much time each side has left, **so that** I can play on time and not lose by the flag.
  - The clocks count down the remaining time of the current player with tenth-of-a-second precision below 10 seconds and second precision above 10.
  - At the start both clocks show the time of the chosen mode (1:00 / 3:00 / 10:00 / 30:00).
  - After a move is completed the clock of the player who moved stops; the opponent's clock starts ticking.
  - When a player has **less than 10 seconds**, their clock changes to a warning color (coral) — so it's noticeable in peripheral vision.
  - If a player's flag falls (time reaches 0:00) **and** the opponent has at least some material to deliver mate, the game ends with the result "Opponent wins. Flag.". If the opponent has insufficient mating material (for example, only a king), the game ends in a draw: "Draw. Opponent has insufficient material.".
  - **Acceptance Criteria:**
    - [x] Given the player started a Blitz game, when they look at the clocks, then they see "3:00" for white and "3:00" for black, one at the bottom and one at the top.
    - [x] Given the game is in progress and white has moved, when one second has passed, then white's clock is unchanged and black's clock has decreased by one second.
    - [x] Given the game is in progress in Blitz and white has 9 seconds left on the clock, when they look at the clock, then white's clock shows the time with tenth-of-a-second precision ("9.3" or "9.0") and the clock color is coral.
    - [x] Given the game is in progress, white has 0.0 on the clock and has not moved, black has a queen and king on the board, when white's clock reaches zero, then the game ends and the "White lost. Flag." screen appears.
    - [x] Given the game is in progress, white has flagged, black has only a king on the board, when white's clock reaches zero, then the game ends in a draw with "Draw. Opponent has insufficient material.".

### 2.4 Ending the game by board rules

- **As** a player, **I want** the game to end automatically by chess rules, **so that** I don't have to manually acknowledge the result.
  - **Checkmate.** If after a move the opponent cannot make any legal move and their king is in check, the game ends with "White/Black win. Checkmate.".
  - **Stalemate.** If the opponent cannot make any legal move and their king is NOT in check, the game ends with "Draw. Stalemate.".
  - **Insufficient material.** If only kings remain on the board (or king+bishop / king+knight vs. king, where mate is impossible), the game ends with "Draw. Insufficient material.".
  - **Threefold repetition.** If the same position (with the same castling rights and possible en passant capture) occurs for a third time in the game, the game ends with "Draw. Threefold repetition.".
  - **50-move rule.** If over the last 50 moves (of each player) there has been no capture and no pawn move, the game ends with "Draw. 50-move rule.".
  - **Acceptance Criteria:**
    - [x] Given the white player makes a move that delivers checkmate to black (for example "Scholar's mate" Qxf7#), when the move is complete, then the game ends immediately and the "White wins. Checkmate." screen appears.
    - [x] Given a position where black has no legal moves but the king is not in check (stalemate), when the move leading to that position is complete, then the game ends and the "Draw. Stalemate." screen appears.
    - [x] Given only two kings remain on the board, when a position with only kings is reached, then the game ends in a draw with "Draw. Insufficient material.".
    - [x] Given the same position (with the same move possibilities) occurs for a third time in the game, when the move leading to the third repetition is made, then the game ends with "Draw. Threefold repetition.".

### 2.5 Player actions during a game

- **As** a player, **I want** to be able to resign or offer a draw, **so that** I don't drag out a hopeless game.
  - Below the board there are two buttons: **"Resign"** and **"Offer draw"**. Both apply to the side whose turn it is (since in hotseat the same physical button is pressed by whoever is at the board).
  - A click on "Resign" opens a confirming dialog "Resign as `white/black`? Cancel / Resign". Choosing "Resign" ends the game with the result "White/Black resigned. Opponent wins.".
  - A click on "Offer draw" opens the dialog "White/Black offer a draw. Decline / Accept." (hotseat: the other player is right there, at the same screen). Choosing "Accept" ends the game "Draw. By agreement.". Choosing "Decline" closes the dialog and the game continues.
  - **Acceptance Criteria:**
    - [x] Given the game is in progress, white's turn, when the white player presses the "Resign" button, then a dialog "Resign as white?" opens with "Cancel" and "Resign" buttons.
    - [x] Given the resignation dialog for white is open, when the player presses "Resign", then the dialog closes, the game ends, and the "White resigned. Black wins." screen appears.
    - [x] Given the resignation dialog is open, when the player presses "Cancel", then the dialog closes and the game continues from the state before the "Resign" click.
    - [x] Given the game is in progress, black's turn, when the black player presses "Offer draw" and in the dialog that appears presses "Accept", then the game ends with a draw "Draw. By agreement.".
    - [x] Given the draw offer dialog is open, when the player presses "Decline", then the dialog closes, the game continues, and the clocks keep ticking for the side whose turn it was.

### 2.6 Move history

- **As** a player, **I want** to see all moves made in the game, **so that** I can orient myself in the position and review my decisions.
  - To the right of the board — a move history panel. Moves are displayed in pairs: move number, white's move, black's move.
  - A move entry is in standard algebraic notation (SAN): "e4", "Nf3", "O-O", "Qxh7#", "e8=Q", etc.
  - With many moves the panel scrolls; the last move is visually highlighted (row background color).
  - **Acceptance Criteria:**
    - [x] Given the player made the first move with white (for example e4), when they look at the move history panel, then they see one entry: "1. e4", highlighted as the last move.
    - [x] Given white played e4, black replied e5, when the player looks at the move history panel, then they see one row "1. e4 e5" and the last move (e5) is highlighted.
    - [x] Given 50 moves have been made in the game and the history panel is filled beyond the visible area, when the player looks at the panel, then it is automatically scrolled down so that the last move is visible.

### 2.7 Game result screen

- **As** a player, **I want** to see the game result and start a new one, **so that** I don't lose momentum between games.
  - At the end of the game (for any reason — mate, stalemate, flag, draw, resignation) a result modal appears over the board with: a result title (for example "White wins. Checkmate."), a short subtitle line (for example "Black has no legal moves"), two buttons: **"New game"** and **"Close"**.
  - A click on "New game" closes the modal and returns page `/game` to the mode selection block (as on first open).
  - A click on "Close" simply dismisses the modal, leaving the board with the final position visible (without the ability to make moves — the clocks are stopped). The position can be reviewed but the game cannot continue.
  - **Acceptance Criteria:**
    - [x] Given the game ended by checkmate for white, when the result screen appears, then the title is "White wins. Checkmate." and the "New game" and "Close" buttons are visible.
    - [x] Given the result modal is open, when the player presses "New game", then the modal closes and the page returns to the mode selection screen with the "Start game" button.
    - [x] Given the result modal is open, when the player presses "Close", then the modal closes, the board with the final position remains visible, the clocks are stopped, and the "Resign" and "Offer draw" buttons are hidden or disabled.

### 2.8 Access to the page

- **As** a guest, **I want** to understand whether this functionality is available to me, **so that** I don't run into a blocked page.
  - Decision for this feature: page `/game` is available to both guests and signed-in players — so you can try the board without an account (hotseat isn't tied to identity).
  - In the header, regardless of status, a link to `/game` appears — "Hotseat" (or similar short text, the designer will refine).
  - For a signed-in player, future specs will add "Find game" (matchmaking) and "Play vs bot" buttons; they will lead to separate pages. `/game` stays as hotseat mode.
  - **Acceptance Criteria:**
    - [x] Given the guest is on the home page, when they look at the header, then they see the "Hotseat" link that leads to `/game`.
    - [x] Given the guest followed the "Hotseat" link, when the `/game` page loaded, then they see the mode selection screen and the "Start game" button (no redirect to `/login`).
    - [x] Given a signed-in player opened `/game`, when the page loaded, then they see the same mode selection screen and can start a hotseat game regardless of their status in the rating system.

---

## 3. Scope and Boundaries

### In-Scope

- Page `/game` with hotseat mode (two players play in the same browser, passing mouse/touch).
- Time mode selection (4 modes from product-definition: Bullet 1m / Blitz 3m / Rapid 10m / Classical 30m).
- Full chess engine: all move rules (including castling, en passant, pawn promotion), detection of checkmate, stalemate, insufficient material, threefold repetition, 50-move rule.
- Clocks with automatic side switching per move, visual warning under 10 seconds, flag-fall handling (including the "opponent has insufficient material" case).
- Dialogs: piece choice on promotion, resignation confirmation, draw offer.
- Highlighting of legal moves, highlighting of the last move, coordinate grid on the board.
- Move history panel in SAN notation, scrolling, highlighting of the last move.
- Result screen with title, subtitle, "New game" and "Close" buttons.
- Access to `/game` for guests and signed-in players. "Hotseat" link in the header.
- Keyboard support: Enter confirms the default piece in the promotion dialog; Esc closes any dialog.
- Works on screens from 375px (mobile) to desktop.

### Out-of-Scope

- Matchmaking and online opponent pairing — a separate spec.
- Game vs the Stockfish bot — a separate spec.
- Rating changes after a game — a separate spec.
- Saving games to the player's history (list of past games, move-by-move replay) — a separate spec.
- PGN export, FEN import — not in MVP.
- In-game chat, emoji reactions — not in MVP.
- Post-game analysis (arrows, computer position evaluation) — not in MVP.
- Chess variants (Chess960, Crazyhouse, Atomic, etc.) — not in MVP.
- Time increment presets (Fischer / Bronstein) — only basic control without increment in MVP.
- Board flipping (so black sees the board from their side) — intentionally disabled in hotseat; will appear in the online variant.
- Rematch offer after a game (back-to-back matches) — not in MVP, but we account for the fact that "New game" starts a new game with the same settings, which is close in effect.
- Branded illustrations, 3D pieces, move sounds — not in MVP (we use standard open piece sets).

---

## Change Log

_No amendments yet._
