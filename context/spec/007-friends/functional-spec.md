# Functional Specification: Friends

- **Topic:** Social layer — nickname search, bidirectional friend requests with Accept/Decline, friends list with online indicator, direct challenge to a game (bypassing matchmaking), and unfriend.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

This is the last Core MVP feature from `product-definition.md` §2.1 ("Friends — nickname search, send/receive requests, list of friends, challenge a friend to a game directly") and §2.2 (step 6 — "add opponent to friends"). Without it, the only way to play against a specific person is to hope matchmaking pairs them at the right rating in the right mode within the right 10-second window. That is a terrible fit for both personas: Misha wants to replay his beer-league friends; Anna wants to study against a specific club rival. Shipping Friends unlocks the "play with the people I actually know" use case the product keeps implicitly promising.

**Problem we are solving:**
- For **Misha the amateur** — he knows exactly who he wants to play ("my friend Danya"), but there is no way to find him on the platform except by waiting for random pairing. Friction kills the retention loop.
- For **Anna the club player** — she needs a controlled list of rivals to prepare against. Random matchmaking produces random opposition. A friends list lets her pick her ladder.
- For **both** — the Online Rematch button from spec 004 only reaches the player you just played. Friends make a long-lived opponent list possible.

**How we measure success:**
- From opening `/friends` to seeing the loaded friends list — **no more than 500 ms**.
- From sending a friend request to recipient seeing the pending card on their own `/friends` page — **no more than 1 second** (either live via socket or on next page open).
- From clicking "Challenge" to the opponent seeing the Accept/Decline toast — **no more than 500 ms** (socket-driven).
- When a friend goes online or offline, the green/grey indicator on my `/friends` page updates within **2 seconds**.

---

## 2. Functional Requirements (The "What")

### 2.1 Entry point and page structure

- **As** a signed-in player, **I want** a dedicated `/friends` page reachable from the header, **so that** the social layer has an obvious home I can bookmark.
  - A new link "Friends" appears in the header for signed-in users, between "vs Bot" and the avatar/profile dropdown. For guests, the link is not shown — Friends is a signed-in-only feature.
  - The link shows a small badge with the count of pending inbound requests when that count is > 0 (e.g. "Friends (2)"). The badge is suppressed when the count is 0.
  - Clicking the link opens `/friends`, protected by `ProtectedRoute` (guest → redirect to `/login`).
  - The `/friends` page has three tabs/sections, selectable via `?tab=` URL state (`?tab=friends` default, `?tab=requests`, `?tab=search`):
    1. **Friends** (default tab) — accepted friendships.
    2. **Requests** — pending inbound requests from other players.
    3. **Search** — nickname lookup form.
  - Default values (tab=friends) do NOT appear in the URL — only `?tab=requests` and `?tab=search` are written. Back button navigates between tabs naturally.
  - **Acceptance Criteria:**
    - [x] Given a signed-in player opens the app, when they look at the header, then they see a "Friends" link between "vs Bot" and their avatar menu.
    - [x] Given a signed-in player has 2 pending inbound friend requests, when they look at the header, then the "Friends" link shows a badge "(2)".
    - [x] Given a guest opens the app, when they look at the header, then the "Friends" link is NOT visible.
    - [x] Given a signed-in player clicks "Friends" in the header, when the page loads, then they land on `/friends` with the "Friends" tab active and the URL has no `?tab` parameter.
    - [x] Given a signed-in player clicks the "Requests" tab, when the view switches, then the URL becomes `/friends?tab=requests` and the browser Back button returns them to the Friends tab.
    - [x] Given a guest navigates to `/friends` directly, when the page tries to load, then they are redirected to `/login` with return-to behavior.

### 2.2 Nickname search and sending a friend request

- **As** a signed-in player, **I want** to search for other players by nickname and send them a friend request, **so that** I can connect with people I already know.
  - The **Search** tab contains a single text input "Search by nickname" and a results area below.
  - Typing in the input triggers a server-side search as the user types (debounced ~300 ms). Match is **case-insensitive substring** against stored nicknames. Results are capped at **20 entries**.
  - For each result, a card shows:
    - Nickname.
    - A context-aware action button on the right:
      - If this user is already my friend → label "Friend" (disabled; or shown as a small badge instead of a button).
      - If I have already sent them a pending request → "Request pending" (disabled).
      - If they have already sent me a pending request → "Accept request" (clicking it accepts, moves them to my Friends tab, equivalent to the Accept button in Requests tab).
      - Otherwise → "Add friend" (enabled).
    - I CAN'T see or interact with my own record in search results (filter myself out server-side).
  - Clicking "Add friend" sends a friend request to that user. The button is replaced with "Request pending" (optimistic; if the server rejects, show a short inline error and revert).
  - When the search box is empty, the results area shows a hint: "Type a nickname to start searching."
  - **Acceptance Criteria:**
    - [x] Given a signed-in player opens the Search tab, when they look at the view, then they see an input "Search by nickname" and an empty-state hint "Type a nickname to start searching."
    - [x] Given a signed-in player types "bob" and bob exists, when the debounce fires, then within ~500 ms a card for "bob" appears with an "Add friend" button.
    - [x] Given a player's query matches 25 nicknames in the database, when the results render, then at most 20 are shown.
    - [x] Given alice has already sent bob a friend request, when alice opens Search and types "bob", then bob's card shows a disabled "Request pending" indicator instead of "Add friend".
    - [x] Given alice is already friends with bob, when alice searches "bob", then bob's card shows a "Friend" indicator instead of a button.
    - [x] Given bob has already sent alice a request, when alice searches "bob", then bob's card shows an "Accept request" button; clicking it accepts and moves bob to the Friends tab.
    - [x] Given alice searches "alice" (her own nickname), when the results render, then her own card is NOT included.
    - [x] Given alice clicks "Add friend" on bob's card, when the request is sent, then the button is immediately replaced with "Request pending" and bob receives the request (visible in his Requests tab).

### 2.3 Requests tab (inbound requests, Accept / Decline)

- **As** a signed-in player receiving requests, **I want** a clear inbox of pending inbound friend requests, **so that** I can Accept or Decline each one.
  - The **Requests** tab lists all **pending inbound** requests (people who sent ME a request) in reverse chronological order (newest first).
  - Each row shows:
    - Requester's nickname.
    - When the request was sent (relative time, e.g. "2 hours ago", with absolute timestamp on hover via `title` attribute).
    - Two buttons: **"Accept"** (primary) and **"Decline"** (secondary).
  - Clicking **Accept** removes the row immediately (optimistic), adds the requester to the Friends list, and the badge in the header decrements. The requester's own Friends tab shows the new friend on their next load (or earlier via live socket update).
  - Clicking **Decline** removes the row immediately (optimistic) and the request is marked declined server-side. The requester is NOT notified explicitly — they just see "Add friend" again if they look up this user in Search (allowed to re-send; no cooldown in MVP).
  - If there are no pending requests, the tab shows an empty-state card: heading "No pending requests", body "Nicknames you add from Search will send a request here when the other player opens their Friends page."
  - **Acceptance Criteria:**
    - [x] Given alice has sent bob a friend request, when bob opens the Requests tab, then he sees a row with alice's nickname, relative time, and "Accept"/"Decline" buttons.
    - [x] Given bob clicks "Accept" on alice's request, when the response arrives, then the row disappears, the header badge decrements, and alice appears in bob's Friends tab.
    - [x] Given bob clicks "Decline" on alice's request, when the response arrives, then the row disappears, the header badge decrements, and alice does NOT appear in bob's Friends tab.
    - [x] Given alice sent bob a request, bob declined, and alice later searches "bob" again, when the results render, then bob's card shows "Add friend" again (no cooldown).
    - [x] Given bob has zero pending requests, when he opens the Requests tab, then he sees the empty-state card "No pending requests".

### 2.4 Friends tab (list, online indicator, challenge, unfriend)

- **As** a signed-in player, **I want** my friends list to show who's online and give me direct actions (challenge, unfriend), **so that** the list is useful day-to-day, not just a static collection.
  - The **Friends** tab lists all accepted friendships, sorted by: online friends first, then offline. Within each group, newest friendship first.
  - Each row shows:
    - **Online indicator** — a small dot: filled green when the friend has at least one active socket connection, hollow grey otherwise.
    - **Nickname.**
    - **Rating** — show the friend's rating in the mode you most recently played, OR a reasonable default (Blitz) if you haven't played them. (Pick: show the four modes compactly, or a single rating. For simplicity in MVP, show their Blitz rating. See Scope note.)
    - **"Challenge"** button — enabled when the friend is online; disabled with tooltip "Offline" when they're not; and disabled with tooltip "In another game" when they're currently in an online game. Clicking opens the Challenge modal (§2.5).
    - **"⋯" overflow menu** with one entry: **"Unfriend"**.
  - The list refreshes online indicators in real time via socket events. When a friend's socket count transitions 0 → 1 or 1 → 0, the indicator updates within ~2 seconds.
  - If there are no friends, the tab shows an empty-state card: heading "No friends yet", body "Search for other players by nickname in the Search tab, or add your opponent after a game.", and a single primary button "Find players" that switches to the Search tab.
  - **Acceptance Criteria:**
    - [x] Given alice is friends with bob (who is online), when alice opens the Friends tab, then she sees bob's row with a filled green dot, his nickname, his Blitz rating, and a "Challenge" button.
    - [x] Given bob goes offline while alice is on the Friends tab, when 2 seconds pass, then the dot next to his name changes to hollow grey and the Challenge button becomes disabled with tooltip "Offline".
    - [x] Given alice is friends with bob (online, but bob is currently in another online game), when alice looks at bob's row, then the Challenge button is disabled with tooltip "In another game".
    - [x] Given alice has 3 friends (2 online, 1 offline), when the list renders, then the 2 online friends are listed first, offline friend last.
    - [x] Given alice has no friends, when she opens the Friends tab, then she sees the empty-state card "No friends yet" with the "Find players" button that switches to the Search tab.

- **Unfriend:**
  - Clicking the overflow menu "⋯" → "Unfriend" opens a confirmation dialog: "Unfriend `<nickname>`?" with buttons "Cancel" and "Unfriend".
  - Clicking "Unfriend" removes the row from both players' Friends tabs. The relationship is deleted, not archived. Re-adding is possible via Search (requires a fresh request).
  - **Acceptance Criteria:**
    - [x] Given alice is friends with bob, when alice clicks the "⋯" menu on bob's row and selects "Unfriend", then a confirmation dialog "Unfriend bob?" appears with "Cancel" and "Unfriend" buttons.
    - [x] Given alice confirms the unfriend action, when the response arrives, then bob disappears from alice's Friends tab and alice disappears from bob's Friends tab.
    - [x] Given alice unfriended bob yesterday, when she searches "bob" today, then bob's card shows "Add friend" (not "Friend"), and clicking it sends a fresh request.

### 2.5 Challenge a friend to a game

- **As** a signed-in player, **I want** to challenge an online friend to a game directly, bypassing matchmaking, **so that** I can play with exactly the person I want.
  - Clicking "Challenge" on a friend's row opens a **Challenge modal** with:
    - Dropdown or four cards for **mode**: Bullet / Blitz / Rapid / Classical. Default: Blitz.
    - Three options for **color**: White / Black / Random. Default: White.
    - Primary button "Send challenge" and secondary button "Cancel".
  - On "Send challenge":
    - Modal replaces its body with a "Waiting for `<nickname>` to accept… (00:60)" countdown. Secondary button becomes "Cancel challenge".
    - The opponent (bob) sees a toast/banner on whichever page he currently has open: "alice challenges you to a Blitz game — Accept / Decline" with its own 60-second countdown.
    - If opponent accepts: both players are navigated to the game (same `game.start` flow as matchmaking in spec 004). The challenger's chosen color is honored (random is rolled server-side at the moment of accept). Rating recalculation happens as in spec 004 — challenged games count toward rating.
    - If opponent declines: challenger sees "`<nickname>` declined your challenge" toast and the modal closes. No cooldown.
    - If the 60-second timer expires on either side with no response: both see "Challenge expired" and the modal closes.
    - If challenger clicks "Cancel challenge" during waiting: opponent's toast disappears; challenger's modal closes.
  - Only **one outbound challenge per challenger** at a time. If alice already has an outbound challenge to bob and clicks Challenge on carol, carol's challenge replaces the one to bob (bob's toast disappears; alice is now waiting on carol).
    - Simplification: when a new challenge is sent while an outbound one is pending, the pending one is auto-cancelled server-side.
  - Alice cannot challenge if alice is already in an active online game. The Challenge button on her side is disabled with tooltip "Finish your current game first."
  - If alice and bob both send each other challenges simultaneously (rare race): the second-arriving challenge is treated as an auto-accept of the first. Both are dropped into a game using the first challenger's mode + color choice.
  - **Acceptance Criteria:**
    - [x] Given alice opens the Challenge modal for bob (online), when she sees the modal, then she sees mode options (Bullet/Blitz/Rapid/Classical) with Blitz selected, color options (White/Black/Random) with White selected, and buttons "Send challenge" and "Cancel".
    - [x] Given alice selects Rapid + Random and clicks "Send challenge", when the modal updates, then it shows "Waiting for bob to accept… (00:60)" with a counting-down timer and a "Cancel challenge" button.
    - [x] Given alice has an outbound challenge to bob, when bob sees his screen, then a toast "alice challenges you to a Rapid game" is visible with "Accept" and "Decline" buttons and its own 60-second countdown.
    - [x] Given bob clicks "Accept", when the server resolves the challenge, then both alice and bob are navigated to a new game of the challenger's chosen mode (same `game.start` flow as spec 004), the chosen color is applied, and the game affects their ratings normally.
    - [x] Given bob clicks "Decline", when the response arrives, then alice sees a toast "bob declined your challenge" and her Challenge modal closes.
    - [x] Given alice sent bob a challenge and 60 seconds pass with no response, when the timer hits 0, then alice sees "Challenge expired" and bob's toast disappears.
    - [x] Given alice has a pending outbound challenge to bob and sends a new challenge to carol, when carol gets her toast, then bob's toast disappears (bob's challenge was auto-cancelled) and alice is now waiting on carol.
    - [x] Given alice is in an active online game, when she tries to challenge bob from `/friends`, then the Challenge button is disabled with the tooltip "Finish your current game first."

### 2.6 Live notifications for pending requests and challenges

- **As** a signed-in player anywhere in the app, **I want** to be notified of inbound requests and challenges in real time, **so that** I don't miss them while on another page.
  - **Inbound friend request:** when another player sends me a friend request, a small toast appears in the top-right corner on whatever page I'm on: "<nickname> wants to be your friend" + "View" button (navigates to `/friends?tab=requests`). The header's "Friends" badge count increments. The toast auto-dismisses after 10 seconds.
  - **Inbound challenge:** when another player (who is already my friend) challenges me, a modal/banner appears in the top-right (or center on mobile) with the full Accept/Decline UI described in §2.5. Does NOT auto-dismiss — it stays until I respond or the 60-second server timer expires.
  - **Online/offline flips:** no explicit toast. The green dots on `/friends` just update.
  - The notifications work on every authenticated page (`/`, `/play`, `/vs-bot`, `/profile`, `/history/:gameId`, `/friends`). Not shown on `/login` or `/register` of course.
  - **Acceptance Criteria:**
    - [x] Given alice is on `/vs-bot` playing against the engine, when bob sends her a friend request, then a toast "<bob> wants to be your friend" with a "View" button appears top-right and the header "Friends" badge increments.
    - [x] Given alice is on `/profile`, when bob (her friend, online) challenges her to Blitz, then she sees a challenge modal/banner with Accept/Decline + 60s timer.
    - [x] Given alice is on `/login` (not signed in), when any backend event targets her previous user id, then nothing is shown (she isn't authenticated).

### 2.7 Edge cases and access control

- **Self-targeting:** you cannot search yourself, cannot send a friend request to yourself, cannot challenge yourself. Server-side rejections return a benign "operation not allowed" without specific detail.
- **Already-friends:** sending "Add friend" to someone you're already friends with → server returns 409; client just updates the card to "Friend" (reconciliation, not an error toast).
- **Already-pending outbound:** sending "Add friend" when you already have a pending outbound request → server returns 409; client silently updates the card to "Request pending".
- **Already-pending inbound (reverse):** sending "Add friend" to someone who already sent YOU a request → server auto-accepts (symmetric creation). Client-side: card becomes "Friend".
- **Blocked:** out of scope for MVP. (If both parties exist as users, they can interact.)
- **Deleted account:** out of scope for MVP (no account deletion flow yet; see spec 001 out-of-scope). If future delete occurs, friendships involving the deleted user are cascade-removed.
- **Guest access to `/friends`:** `ProtectedRoute` redirects to `/login` with return-to behavior, same pattern as `/profile` and `/play`.
- **Acceptance Criteria:**
  - [x] Given alice sends a friend request to bob who already sent her one, when the server processes, then alice and bob are automatically friends; alice's card shows "Friend"; bob's Requests tab no longer has her request (because they're now friends).
  - [x] Given alice tries to send a request to herself via the API, when the server receives it, then the request is rejected (any 4xx — the client UI prevents this anyway by filtering self out).

---

## 3. Scope and Boundaries

### In-Scope

- `/friends` page with 3 tabs (Friends / Requests / Search) and `?tab=` URL state.
- Header link "Friends" with pending-request count badge; signed-in users only.
- Nickname search: case-insensitive substring match, capped at 20 results, debounced ~300 ms, self filtered out.
- Friend request lifecycle: pending → accepted / declined. Declined re-sends allowed with no cooldown.
- Automatic auto-accept when symmetric request from the other side already exists.
- Friends list: sorted online-first, shows nickname + Blitz rating + online dot + Challenge button + unfriend menu.
- Online indicator: real-time via socket events (reuses `user:{userId}` socket count pattern from spec 004 §2.9). Updates within ~2 s.
- Unfriend with confirmation dialog. Clean deletion of the friendship record (no soft-delete).
- Challenge modal with mode + color selection, 60-second accept/decline window, auto-cancel on new outbound challenge, auto-handling of simultaneous mutual challenges, disabled state when challenger is already in a game or opponent is offline / in another game.
- Live toasts/notifications for inbound requests and inbound challenges across all authenticated pages.
- Rating effect: challenge-games count toward rating exactly like matchmaking games (reuse spec 004 ELO flow).

### Out-of-Scope

- Public profiles / opponent profile pages (no `/u/<nickname>` route — still deferred as noted in spec 006).
- Blocking users — a separate moderation spec.
- "Last seen X minutes ago" offline timestamp (only online/offline binary).
- Friend groups / categories / nicknames (`"my club players"`).
- Direct messaging / chat with a friend — not in MVP.
- Importing friends from other platforms (lichess, chess.com) — not in MVP.
- Suggestions / "people you may know" — not in MVP.
- Friend-only leaderboards — not in MVP.
- Showing friends' rating across all four modes in the row — MVP shows Blitz only (keeps the row small; multi-mode rating UX is a separate design pass).
- Mutual-friend count on cards — not in MVP.
- Custom time controls in Challenge — not in MVP (same four fixed modes as spec 004, consistent with that spec's own Scope).
- Rematch-against-friend-list — out of MVP; after a game, add-friend is manual via Search or opponent card (opponent card as entry point is also deferred).
- Spectate a friend's live game — not in MVP.
- Email notifications for friend requests — not in MVP; only in-app toasts.
- Scheduled / future-dated challenges — not in MVP.
- Challenge from someone who is NOT my friend — not in MVP (challenge requires existing friendship, keeps spam low).

---

## Change Log

_No amendments yet._
