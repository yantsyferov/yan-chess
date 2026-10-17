# Functional Specification: Home Page Games List

- **Topic:** Add a "Recent games" list to the home page showing a signed-in player's last 10 finished games, with a "View all games" button underneath that routes to a dedicated full history page.
- **Status:** Draft
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Today the home page is almost empty for a signed-in player: a greeting, the mode selector, and a "Play vs bot" link. The player's own game history — the record of what they've been playing, how it went, how their rating moved — lives one navigation hop away on the Profile page. A player who comes to the site to jump back into chess has to click through to Profile just to glance at "did I win the last one? what did I play with Bob yesterday?"

This spec surfaces the player's last-10 finished games right on the home page, directly below (or alongside) the existing content. Each row shows the same information today's Profile history row does (opponent, mode, result, rating delta, date, Rated/Casual badge) and clicking a row opens its replay — same as from the Profile page. A **"View all games"** button under the list links to a dedicated full-history page where the player can filter and paginate through everything they've ever played.

The full history page is a new destination — today the full history lives inside Profile under "Game history". The dedicated page gives it its own URL (bookmarkable, shareable), while Profile continues to be the player's identity surface.

**Success is measured by:**
- A signed-in player opening the home page sees their last 10 finished games without any extra click, with each row readable at a glance.
- Clicking any row opens its replay — same behavior as from Profile today.
- Clicking "View all games" lands on a full-history page with every game, filters, and pagination.
- A signed-in player with zero games sees an empty-state card inviting them to play (same copy / actions as the current "No games yet" state).

---

## 2. Functional Requirements (The "What")

### 2.1 Recent games section on the home page

- Below the existing home-page content (greeting + mode selector + "Play vs bot" link), signed-in players see a new section titled **"Recent games"** (localized into English / Russian / Spanish).
- The section renders a list of the player's **last 10 finished games**, newest first.
- Each row shows: date, opponent (nickname + country flag + their rating-after), mode (Bullet/Blitz/Rapid/Classical), **Rated** or **Casual** badge, result (Win / Loss / Draw), end reason (checkmate / resignation / timeout / stalemate / etc.), and the rating change (`+12` / `−8` / `0`). The row layout matches the layout used on the Profile history today — same visual pattern, same clickable area.
- Clicking a row navigates to that game's replay screen (same existing replay destination).
- If the player has fewer than 10 finished games, the section shows just the ones they have (no empty padding, no placeholders).
- If the player has zero finished games, the section renders an empty-state card with the same message and action buttons the Profile page's empty state uses today ("No games yet — finish an online game, it will show up here"; "Find game" + "Play vs bot" buttons). Training games vs the bot still do not appear.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player with 10 or more finished games opens the home page, when the page loads, then they see a "Recent games" section with their 10 most recent games listed newest first.
  - [ ] Given a signed-in player with 3 finished games opens the home page, when the page loads, then the "Recent games" section shows exactly 3 rows (not 10 rows with 7 blanks).
  - [ ] Given a signed-in player with 0 finished games opens the home page, when the page loads, then the "Recent games" section shows the empty-state card with "No games yet" + "Find game" and "Play vs bot" buttons.
  - [ ] Given a signed-in player's "Recent games" list is rendered, when they click any row, then they land on that game's replay screen (same destination as clicking from the Profile history).
  - [ ] Given a signed-in player has played both Rated and Casual games, when they look at the "Recent games" list, then each row shows the correct "Rated" or "Casual" badge next to the mode.

### 2.2 "View all games" button

- Below the last row of the "Recent games" list, a **"View all games"** button is rendered. Clicking it routes to a dedicated full-history page.
- The button is visible even if the player has fewer than 10 games — as soon as there is at least one game, "View all games" lets them reach the full-history page (which may still be short, but it's the proper destination).
- If the player has **zero** games, the "View all games" button is **not** shown — the empty-state card's action buttons cover that case.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player with 10 or more games opens the home page, when the page loads, then below the "Recent games" list they see a "View all games" button.
  - [ ] Given a signed-in player with 3 games opens the home page, when the page loads, then below the 3 rows they see the "View all games" button.
  - [ ] Given a signed-in player with 0 games opens the home page, when the page loads, then they do NOT see a "View all games" button (the empty-state card is shown instead).
  - [ ] Given a signed-in player clicks the "View all games" button, when the navigation completes, then they land on the full-history page described in §2.3.

### 2.3 Dedicated full-history page

- A new, dedicated full-history page exists at a direct URL (bookmarkable, shareable). The URL path is **"/history"**. The page is behind sign-in — anonymous visitors are redirected to the sign-in page.
- The page shows the complete game history for the signed-in player: paginated list (20 rows per page, same as the Profile history list today), filters by mode (Bullet / Blitz / Rapid / Classical / All) and by result (Wins / Losses / Draws / All), chronological order (newest first).
- Row behavior is identical to the "Recent games" list on the home page: click a row → replay screen.
- The page title / heading reads **"Game history"** (localized).
- **Acceptance Criteria:**
  - [ ] Given a signed-in player clicks "View all games" from the home page, when the full-history page loads, then they see a heading "Game history" and a paginated list of all their finished games, newest first.
  - [ ] Given a signed-in player is on the full-history page, when they change the mode filter to "Blitz", then the list re-renders to show only their Blitz games.
  - [ ] Given a signed-in player is on the full-history page, when they change the result filter to "Losses", then the list re-renders to show only their losses.
  - [ ] Given a signed-in player is on the full-history page with 50+ games, when they open the page, then the list shows 20 rows and pagination controls at the bottom.
  - [ ] Given an anonymous visitor types "/history" directly in the URL bar, when the page loads, then they are redirected to the sign-in page.

### 2.4 Interaction between the home list, the dedicated history page, and Profile

- The existing Profile page's "Game history" section is **unchanged** by this spec. It continues to show the same paginated history it does today. Profile remains the player's identity surface; the new "/history" page is simply a direct address for the same content.
- The home page's "Recent games" list is a lightweight preview — it does NOT include filters, pagination, or any controls. For filtering or paging, the player uses "View all games" → "/history".
- **Acceptance Criteria:**
  - [ ] Given a signed-in player opens their Profile page, when the page loads, then they see the same "Game history" section they see today — unchanged behavior.
  - [ ] Given a signed-in player is on the home page's "Recent games" list, when they look at it, then there are no filter dropdowns and no pagination controls visible in that section.

### 2.5 Localization

- Every new user-facing string — "Recent games" section heading, "View all games" button, "Game history" page heading, and any new empty-state copy — is translated into English, Russian, and Spanish. The row-level labels (date format, Win/Loss/Draw, Rated/Casual, end reasons) reuse the translations already live from spec 006 + spec 014.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player's language is Russian, when they open the home page, then the "Recent games" heading and the "View all games" button render in Russian.
  - [ ] Given a signed-in player's language is Spanish, when they open "/history", then the "Game history" heading renders in Spanish.

---

## 3. Scope and Boundaries

### In-Scope

- A "Recent games" section on the home page for signed-in players, showing their 10 most-recent finished games with the same row layout as the Profile history today.
- A "View all games" button at the bottom of the "Recent games" list, routing to the dedicated full-history page.
- A new dedicated full-history page at `/history` (behind sign-in) showing paginated history with mode + result filters — same content as today's Profile history, now also reachable via its own URL.
- Empty-state handling for players with zero games (same copy / actions as today).
- Localization of new strings in English / Russian / Spanish.

### Out-of-Scope

- Any change to the Profile page's existing "Game history" section — unchanged.
- A redesign of the row visual — same row layout as today's Profile history.
- Filters or pagination on the home page's "Recent games" list — the compact list is deliberately read-only.
- Including vs-bot training games — those remain out of the persisted history per spec 005.
- Changing which games count as "finished" — same definition as today (completed online games + friend-challenge games).
- Showing other users' histories — this spec only surfaces the signed-in player's own history.
- Any change to the game-replay screen itself.
- Live-updating the home-page list when a game ends in another tab — the list reflects a snapshot at page-load time (same as the Profile history today).

---

## Change Log

_No amendments yet._
