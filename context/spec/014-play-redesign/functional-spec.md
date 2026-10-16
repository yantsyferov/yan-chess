# Functional Specification: Play Page Redesign

- **Topic:** Redesign the `/play` page into a mode-selector showing a decorative chessboard on the left and four game-mode options on the right (Online, vs Bot, vs Friend, vs Human on this computer). Introduce a nested URL pattern `/play/<mode>` for each playable mode. Add a rated/unrated toggle to applicable modes. Build a dedicated vs-Friend lobby at `/play/friend` with a friends-panel-to-challenge-form flow.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Today the `/play` page jumps straight into online matchmaking: the moment a player clicks it they're placed into a queue. There's no landing on the Play screen that would let a visitor say "I want to play against a bot" or "I want to challenge my friend" without first dealing with matchmaking UI. The vs-bot page lives at a different URL (`/vs-bot`), hotseat lives at yet another (`/game`), and challenging a friend requires going through the Friends page first. These paths exist but are not discoverable from one place.

The redesign makes `/play` the single home for every way to start a game. A player who lands there sees a quiet starting-position chessboard — a reminder of what they're here for — and four cards next to it, one for each mode. One click per mode → the right thing happens: either a game starts (Bot, Hotseat) or a lobby opens (Online matchmaking, vs Friend).

Secondary wins this spec delivers:
- **Anonymous visitors see Play.** Today anonymous visitors can't reach `/play` at all — the route is auth-gated and bounces them to the sign-in page. After this spec the mode-selector itself is public: Bot and Hotseat work right there without signing in, Online and vs Friend ask for sign-in only when the user clicks them.
- **A dedicated vs-Friend lobby.** Challenging a friend becomes a first-class flow: open `/play/friend`, see your friend list to the right of a board, pick someone, fill the challenge form (time control, color, rated/unrated), send. The URL is bookmark-able and shareable with "Challenge link" — the link itself is a shortcut UI stub in this spec (toast "Shareable link coming soon"), but the lobby page is real.
- **Rated or unrated.** Players who want a casual game that doesn't move their rating can now toggle "unrated" on both the matchmaking screen and on a friend challenge.

**Success is measured by:**
- A visitor on `/play` without signing in sees four mode cards, can start a vs-bot game or a hotseat game right away.
- A signed-in player on `/play` clicks "vs Friend" → lands on a lobby with their friend list visible, picks a friend, sends a challenge in under five seconds.
- A player who ticks "unrated" and plays an online game sees their rating stay the same after the game ends.
- The URLs `/play`, `/play/ai`, `/play/online`, `/play/friend` are each bookmark-able and route to the right view.

---

## 2. Functional Requirements (The "What")

### 2.1 /play — the mode-selector page

- When a visitor opens `/play`, they see a two-column layout: a non-interactive chessboard in starting position on the left, and four mode cards stacked on the right.
- The chessboard is purely decorative: it shows all 32 pieces in the standard starting setup, is not clickable, and does not react to drag or hover.
- The four mode cards, from top to bottom, are:
  1. **Online** — "Find a human opponent at your level."
  2. **vs Bot** — "Train against the computer."
  3. **vs Friend** — "Challenge a friend to a game."
  4. **vs Human on this computer** — "Two players, one board."
- Each card shows an icon, the mode name, a one-sentence description, and a clickable call-to-action (e.g., "Play Online").
- `/play` is a public page: anonymous visitors see the same four cards signed-in users do.
- **Acceptance Criteria:**
  - [x] Given an anonymous visitor opens `/play`, when the page loads, then they see a chessboard in starting position on the left and four mode cards on the right.
  - [x] Given a signed-in player opens `/play`, when the page loads, then they see the same four mode cards in the same layout.
  - [x] Given the visitor hovers over the chessboard, when nothing is clicked, then no squares highlight and no piece can be moved.
  - [x] Given the visitor sees the mode cards, when they look at them, then the order from top to bottom is: Online, vs Bot, vs Friend, vs Human on this computer.

### 2.2 Anonymous click → sign-in redirect for auth-required modes

- When an anonymous visitor clicks **Online** or **vs Friend** on `/play`, they are taken to the sign-in page. After a successful sign-in they are returned to `/play` (not forwarded further into the mode they clicked — the choice is "come back to the Play screen and pick again").
- When an anonymous visitor clicks **vs Bot** or **vs Human on this computer**, no sign-in is required: the chosen mode starts immediately.
- **Acceptance Criteria:**
  - [x] Given no one is signed in, when the visitor clicks the Online card on `/play`, then they land on the sign-in page.
  - [x] Given no one is signed in, when the visitor clicks the vs Friend card on `/play`, then they land on the sign-in page.
  - [x] Given no one is signed in, when the visitor clicks the vs Bot card on `/play`, then they land directly on the vs-bot setup (no sign-in prompt).
  - [x] Given no one is signed in, when the visitor clicks the vs Human on this computer card on `/play`, then they land directly on the hotseat game page (no sign-in prompt).
  - [x] Given an anonymous visitor was taken to the sign-in page after clicking Online or vs Friend, when they sign in successfully, then they are returned to `/play` with the four cards visible.

### 2.3 /play/ai — vs Bot

- Clicking **vs Bot** on `/play` takes the player to `/play/ai`. This is the same setup + game experience as the previous `/vs-bot` route — difficulty selection, time control, color choice, then the game — now reachable under the `/play/<mode>` naming pattern.
- The old URL `/vs-bot` continues to work: it redirects to `/play/ai` so existing bookmarks and links do not break.
- `/play/ai` is public — no sign-in required.
- **Acceptance Criteria:**
  - [x] Given a player is on `/play`, when they click the vs Bot card, then they land on `/play/ai` and see the bot setup (difficulty, time control, color).
  - [x] Given a visitor types `/vs-bot` into the URL bar, when the page loads, then they are redirected to `/play/ai` with the same setup visible.
  - [x] Given an anonymous visitor is on `/play/ai`, when they complete the setup and start the game, then the game begins without requiring sign-in.

### 2.4 /play/online — matchmaking

- Clicking **Online** on `/play` (when signed in) takes the player to `/play/online`. This is the same matchmaking experience that exists today — pick a time-control mode (Bullet / Blitz / Rapid / Classical), see your rating, click "Find game" — now reachable under the `/play/<mode>` naming pattern.
- A new **rated / unrated** toggle appears on this page, defaulted to "rated". When a player searches with "unrated" ticked, the matching logic still pairs them with players of similar rating but the game that follows does not change either player's rating.
- The pairing rule is unchanged: both players must have the same mode (Bullet/Blitz/etc.) AND the same rated/unrated preference to be matched. A player searching rated Blitz is NOT paired with a player searching unrated Blitz.
- `/play/online` requires sign-in. An anonymous visitor who reaches this URL directly is redirected to the sign-in page.
- **Acceptance Criteria:**
  - [x] Given a signed-in player is on `/play`, when they click the Online card, then they land on `/play/online` with the mode selector (Bullet/Blitz/Rapid/Classical) and the rated/unrated toggle visible, and the "rated" option is selected by default.
  - [x] Given a signed-in player is on `/play/online`, when they toggle to "unrated" and click "Find game", then after the match completes neither their rating nor the opponent's rating changes.
  - [x] Given a signed-in player is on `/play/online` with "rated" selected, when they are matched with another player who also searched with "rated", then their ratings are updated at game end exactly as they are today.
  - [x] Given one player is searching Blitz rated and another is searching Blitz unrated, when both are in the queue, then they are NOT matched with each other.
  - [x] Given an anonymous visitor opens `/play/online` directly, when the page loads, then they are redirected to the sign-in page.

### 2.5 /play/friend — vs-Friend lobby

- Clicking **vs Friend** on `/play` (when signed in) takes the player to `/play/friend`.
- The lobby page shows a two-column layout: a chessboard in starting position on the left (same decorative board as `/play`), and a friends panel on the right.
- The friends panel starts in **list view**: it shows every friend of the signed-in player with their nickname, online indicator (same icon used elsewhere today), and a "Challenge" button next to each row.
- When the player clicks a friend's "Challenge" button, the panel switches to **challenge view** for that friend:
  - The friend's nickname + avatar at the top of the panel.
  - **Time control** selector (Bullet / Blitz / Rapid / Classical) — defaults to Blitz.
  - **Rated / Unrated** toggle — defaults to "rated".
  - **Color** selector (White / Black / Random) — defaults to Random.
  - A primary **"Send challenge"** button.
  - A secondary **"Challenge link"** button below it.
  - A "Back to friends list" link at the top of the panel.
- Clicking **Send challenge** sends the challenge over the existing challenge-notification system, closes the panel, and surfaces the normal challenge-pending UI (same toast behavior that exists today when a friend accepts).
- Clicking **Challenge link** shows a toast with the text **"Shareable link coming soon"** and copies nothing yet — the shareable-URL feature is a stub in this spec.
- Clicking **Back to friends list** restores the friend list view.
- If the signed-in player has zero friends, the panel shows the empty state "No friends yet — add some from the Friends page" with a link to `/friends`.
- `/play/friend` requires sign-in.
- **Acceptance Criteria:**
  - [x] Given a signed-in player with at least one friend opens `/play/friend`, when the page loads, then they see a chessboard on the left and their friends list on the right.
  - [x] Given a signed-in player with zero friends opens `/play/friend`, when the page loads, then the right panel shows "No friends yet — add some from the Friends page" with a link to `/friends`.
  - [x] Given a signed-in player is on `/play/friend` in list view, when they click the "Challenge" button next to a friend, then the panel switches to challenge view for that friend showing the time control, rated toggle, color selector, "Send challenge", and "Challenge link" controls.
  - [x] Given a signed-in player is in challenge view, when they fill the form and click "Send challenge", then a challenge is sent to that friend (verified via the receiving friend getting the normal incoming-challenge toast) and the player's panel returns to the friends list.
  - [x] Given a signed-in player is in challenge view, when they click "Challenge link", then they see a toast with the text "Shareable link coming soon" and the clipboard is not modified.
  - [x] Given a signed-in player is in challenge view, when they click "Back to friends list", then the panel returns to the list view with the same friends they had before.
  - [x] Given a signed-in player is in challenge view and ticks "Unrated" before sending, when the challenged friend accepts the game, then after the game completes neither player's rating changes.
  - [x] Given an anonymous visitor opens `/play/friend` directly, when the page loads, then they are redirected to the sign-in page.

### 2.6 Hotseat on `/game` is unchanged

- Clicking **vs Human on this computer** on `/play` takes the player to `/game` — the existing hotseat page.
- `/game` is public (unchanged), the hotseat experience is unchanged, this spec adds no behavior there beyond the entry point from `/play`.
- **Acceptance Criteria:**
  - [x] Given a player is on `/play`, when they click the vs Human on this computer card, then they land on `/game` with the hotseat setup visible.

### 2.7 Rated flag on persisted games

- Every game that gets persisted (via matchmaking or friend challenge) carries a flag indicating whether it was rated.
- A player's game history shows this flag next to each row — rated games are visually marked as "Rated" (or an equivalent short label), unrated games as "Casual" (or an equivalent short label). The exact label wording is a style decision for the implementation, as long as the two are visually distinct from each other.
- **Acceptance Criteria:**
  - [x] Given a player has played both rated and unrated games, when they open their game history, then each row is visually marked as either "Rated" or "Casual" (or equivalent short labels).
  - [x] Given a player completed an unrated game, when they open the game-end screen, then no rating-change number is shown next to the result (because no rating change occurred).

### 2.8 Localization

- Every new user-facing string on `/play`, `/play/ai`, `/play/online`, `/play/friend`, the rated/unrated toggle, and the game-history "Rated/Casual" label is translated into English, Russian, and Spanish.
- **Acceptance Criteria:**
  - [x] Given the current language is Russian, when the visitor opens `/play`, then all four mode cards render in Russian.
  - [x] Given the current language is Spanish, when a signed-in player opens `/play/friend` in list view, then the "Challenge" button next to each friend reads in Spanish.
  - [x] Given the current language is Russian, when a player opens their game history, then the Rated/Casual column reads in Russian.

---

## 3. Scope and Boundaries

### In-Scope

- The `/play` mode-selector page with a decorative starting-position board + four mode cards.
- New nested URLs: `/play/ai`, `/play/online`, `/play/friend`.
- Redirect from the old `/vs-bot` URL to `/play/ai`.
- Rated / Unrated toggle on `/play/online` (matchmaking) and in the `/play/friend` challenge form.
- Pairing logic that keeps rated and unrated searchers in separate pools.
- Persisting the rated flag on each game so game history can show it.
- The vs-Friend lobby at `/play/friend` with the two-view (list → challenge form) friend panel.
- Localization of all new strings (EN / RU / ES).
- Visibility of the four cards to anonymous visitors; sign-in redirect for Online + vs Friend when anonymous; direct access for Bot + Hotseat.
- "Challenge link" button on the vs-Friend form, as a UI stub that shows a "Shareable link coming soon" toast and copies nothing.

### Out-of-Scope

- A real shareable URL for challenge links — this spec ships only the stub toast.
- Any change to the hotseat page (`/game`) beyond the entry point from `/play`.
- Avatar upload or any other change to the Profile page.
- Mini-popups in the Sidebar (Settings / Friends / Chat / Notifications) — spec 015.
- Country field — spec 015.
- Right-to-left language layout.
- Changing the pairing rating window (keeps the current ±200 ELO rule from spec 004).
- Any change to the chess rules engine, time control enforcement, or clock behavior.
- Removing the standalone Friends page (`/friends`) — it stays as the fuller friend-management surface.

---

## Change Log

- **[2026-10-16]** — `/awos:verify` — all 22 ACs marked complete. Visual verification via Playwright drive against web preview on port 5173 (CORS-allowed by dev-API on 3000). Screenshots at `docs/screenshots/014-play-*.png`: `hub-anon` (RU locale, 4 cards + decorative board), `hub-signed-in` (as alice), `friend-list` (bob visible with "Вызвать" button), `friend-challenge-form` (mode + rated + color + Send + Challenge-link in RU), `online-rated-toggle`. End-to-end: `/vs-bot` auto-redirects to `/play/ai`, `/play/online` + `/play/friend` auth-gated, decorative board renders in starting position. Signed-in flow proved: alice logs in → /play shows mode cards → click vs Friend card → /play/friend lobby → click Challenge for bob → form appears with Russian labels (Режим / Тип партии / Цвет / Отправить вызов / Ссылка на вызов). Non-visual logic criteria (§2.7 rated flag persistence, §2.8 full localization matrix) covered by the 27-test FTR suite at `apps/web/src/__tests__/play-redesign.spec-014.test.tsx` + the 3-test backend FTR at `apps/api/test/e2e/play-redesign.spec-014.e2e.spec.ts` + per-slice coverage (446 web + 142 api unit + 93 api e2e, all green on branch).
