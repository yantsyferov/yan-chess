# Functional Specification: Sidebar Popups + Profile + Country

- **Topic:** Give each of the four sidebar action icons (Settings, Friends, Chat, Notifications) a floating mini-popup that opens anchored to the right of the sidebar. Move Theme, Language, and Sign-out from the sidebar bottom into the Settings popup — removing the temporary Logout icon added by spec 013. Add a Country field to every user (required at registration, optional for existing users, displayed as "International" with a white-flag icon when unset). Redesign the Profile page to show avatar + country + nickname + game history as a unified identity view.
- **Status:** Draft
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Spec 013 shipped the sidebar with four action icons as placeholders — clicking them does nothing. It also had to add a temporary fifth icon (Sign out) in the same row because deleting the horizontal Header removed the only sign-out path. This spec fills in those placeholders and absorbs sign-out into one of them, so the sidebar bottom becomes clean and purposeful.

The Settings popup gathers the three "account tools" that today sit next to each other in the sidebar — theme, language, sign-out — into one coherent menu that reads as "account controls" rather than four separate buttons. Friends gets a quick-access popup that shows the player's current friend list without requiring a page navigation to `/friends` — useful when the player is mid-game and wants to glance at who's online. Chat is deliberately a visual placeholder with "Chat coming soon" — the icon stays visible so the sidebar structure doesn't change when the feature actually lands. Notifications is a stubbed UI (icon + empty "no new notifications" panel) to establish the slot for a future spec to wire real data into.

The Country field is a long-standing identity gap: today a player's profile shows only their nickname and rating. For an international product (English/Russian/Spanish speakers already supported after spec 012), surfacing country is standard — it's how chess platforms communicate "I'm playing someone from Mexico" without exchanging a single message. New users are required to pick a country during sign-up. Existing users keep playing without being forced to pick — their country shows as "International" (white flag) until they set one on their profile page.

The Profile page redesign ties this together. Today Profile is a thin wrapper around the ratings table and recent games. After this spec, Profile shows the player's full identity card at the top (avatar, nickname, country with flag) and the full game history below. Avatar upload is NOT in this spec — the placeholder avatar from spec 013 continues to be shown; replacing it with real uploads is a separate future spec that needs a storage backend.

**Success is measured by:**
- A signed-in player can switch theme, switch language, and sign out — all three — from a single popup opened by clicking the Settings icon in the sidebar.
- The sidebar bottom under the avatar/nickname row contains only the four action icons (Settings, Friends, Chat, Notifications). No separate theme toggle, no separate language switcher, no separate logout icon.
- A player can see their friend list without leaving the current page by clicking the Friends icon in the sidebar.
- A new visitor registering today must pick a country before the account is created.
- An existing user whose country is unset sees "International" with a white-flag icon on their profile; after choosing a country on the profile page, they immediately see the chosen country + flag everywhere their profile is displayed.
- The Profile page shows avatar + nickname + country (with flag) at the top, and the player's full game history below.

---

## 2. Functional Requirements (The "What")

### 2.1 Four mini-popups anchored to the sidebar icons

- Clicking any of the four action icons in the sidebar (Settings / Friends / Chat / Notifications) opens a **floating panel** anchored to the right edge of the sidebar, aligned to the clicked icon's vertical position. The panel does not shift the main content — it floats on top with a subtle drop-shadow, same visual weight as other dropdown menus in the app.
- Only one popup is open at a time. Clicking a second icon closes the first and opens the second. Clicking the already-open icon closes it. Clicking anywhere outside the popup closes it. Pressing `Escape` closes it.
- The panels have a fixed width of approximately 320 pixels and a maximum height of about 70% of the viewport height — scroll inside the panel if content exceeds.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player is on any main-app page, when they click the Settings icon in the sidebar, then a floating panel appears to the right of the sidebar aligned to that icon with Settings content inside.
  - [ ] Given the Settings popup is open, when the player clicks the Friends icon, then the Settings popup closes and the Friends popup opens.
  - [ ] Given any popup is open, when the player presses Escape, then the popup closes.
  - [ ] Given any popup is open, when the player clicks on the main content area outside the popup, then the popup closes.
  - [ ] Given the Settings popup is open and the player clicks the Settings icon again, then the popup closes.

### 2.2 Settings popup content and the sidebar cleanup it enables

- The Settings popup contains, in order top to bottom:
  1. A **Language selector** — same control as today's sidebar bottom (full endonym, dropdown, three options).
  2. A **Theme toggle** — same binary dark/light switch as today's sidebar bottom.
  3. A **Sign out** button that signs the user out and routes them to the sign-in page.
- Section labels (e.g., "Language", "Theme") appear above each control for clarity.
- Because Settings now owns these three controls, the sidebar bottom is cleaned up:
  - The standalone Theme toggle at the bottom of the sidebar is **removed**.
  - The standalone Language selector at the bottom of the sidebar is **removed**.
  - The temporary fifth icon ("Sign out") in the row of action icons — added by spec 013 — is **removed**. Only four action icons remain in that row: Settings, Friends, Chat, Notifications.
- The anonymous sidebar bottom section is unchanged: Login button, Register button, Theme toggle, Language selector (anonymous users have no Settings popup — they have no account to manage).
- **Acceptance Criteria:**
  - [ ] Given a signed-in player opens the Settings popup, when it renders, then they see a Language selector, a Theme toggle, and a Sign out button in that order with section labels above each.
  - [ ] Given a signed-in player is in the Settings popup and switches language from English to Russian, when the switch completes, then every visible label on the page (including the Settings popup itself) updates to Russian immediately — same behavior as today's sidebar language switcher.
  - [ ] Given a signed-in player is in the Settings popup and clicks the Theme toggle, when the toggle completes, then the entire app's theme switches — same behavior as today.
  - [ ] Given a signed-in player is in the Settings popup and clicks Sign out, when it completes, then they land on the sign-in page with the sidebar showing the anonymous bottom (Login + Register + Theme + Language).
  - [ ] Given a signed-in player looks at the sidebar, when they examine the icon row under their avatar, then they see exactly four icons: Settings, Friends, Chat, Notifications — no fifth Sign-out icon.
  - [ ] Given a signed-in player looks at the sidebar, when they examine the area below the icon row, then they see no standalone Theme toggle and no standalone Language selector.
  - [ ] Given an anonymous visitor looks at the sidebar, when they examine the bottom section, then they still see Login + Register + Theme + Language exactly as before.

### 2.3 Friends popup — quick list + link to full page

- The Friends popup contains:
  - A header "Friends" with a count of total friends in parentheses.
  - A list of the player's friends, up to the first 10, each showing avatar + nickname + online indicator. Rows are tappable: tapping a row opens the friends-page `/friends` scoped to that friend (or the friends-page as a whole — the implementation picks the closest existing behavior).
  - If the player has zero friends: empty-state card with text "No friends yet" and a "Find friends" button that routes to `/friends`.
  - At the bottom of the popup: a **"Open full Friends page"** link that routes to `/friends`.
- The popup updates its online indicators in real time — same socket-based online status that the main `/friends` page uses.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player with at least one friend clicks the Friends icon, when the popup opens, then they see a Friends header with the count, their friend list (up to 10 rows), and an "Open full Friends page" link at the bottom.
  - [ ] Given a signed-in player with zero friends clicks the Friends icon, when the popup opens, then they see an empty-state card with "No friends yet" and a "Find friends" button linking to `/friends`.
  - [ ] Given the Friends popup is open and a friend comes online, when the online indicator updates on the main app, then the row in the popup also updates within one second.
  - [ ] Given the Friends popup is open, when the player clicks "Open full Friends page" at the bottom, then they land on `/friends` and the popup closes.
  - [ ] Given the player has 15 friends, when they open the Friends popup, then they see the first 10 rows (any 10 — the ordering follows whatever the full friends page uses by default) and the "Open full Friends page" link makes the remaining 5 reachable.

### 2.4 Chat popup — placeholder

- The Chat icon in the sidebar is **enabled** (not visibly disabled as it was in spec 013). Clicking it opens a popup containing:
  - An icon representing chat (e.g., a speech-bubble)
  - A heading "Chat coming soon"
  - A short description: "Direct messages between friends are on the roadmap."
  - (Optional) A "Learn more" link — may link to a roadmap page or be omitted if no roadmap page exists.
- No input field, no mock conversations, no fake data — purely a visible announcement that the feature is planned.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player clicks the Chat icon, when the popup opens, then they see "Chat coming soon" as the heading and a short descriptive text — no input field, no sample messages.
  - [ ] Given a signed-in player looks at the Chat icon in the sidebar, when they hover it, then it does not show the browser's "not-allowed" cursor — it's a normal clickable icon.

### 2.5 Notifications popup — UI placeholder

- The Notifications icon in the sidebar is enabled. Clicking it opens a popup containing:
  - A header "Notifications"
  - An empty state: "You're all caught up." with a bell icon
- No real notification data is wired in this spec. The slot exists for a future spec to populate.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player clicks the Notifications icon, when the popup opens, then they see a Notifications header and an empty state "You're all caught up."
  - [ ] Given a signed-in player receives a new friend request or incoming challenge, when they open the Notifications popup, then they still see the empty state (no real data wired in this spec — that's a future feature).

### 2.6 Country field — database column and type

- Every user record carries an optional country field. The country is stored as an ISO 3166-1 alpha-2 country code (e.g., `MX`, `RU`, `US`). The field is nullable in the database — a missing value means "no country chosen".
- Existing users at the time this spec ships have `NULL` in the country field — no backfill is performed. They can set one later from their profile page (§2.9).
- **Acceptance Criteria:**
  - [ ] Given a new user successfully registers with a chosen country, when their profile is loaded afterward, then the country they chose is visible on the profile card.
  - [ ] Given an existing user had no country at the time this spec shipped, when they load their profile today, then the country is shown as "International" with a white-flag icon.

### 2.7 Country required at registration

- The sign-up form gains a new required field: **Country**. The field is a **searchable dropdown** showing the ISO list of ~250 countries, each row displaying the country's flag icon + the country name (in the current UI language). The player types to filter the list.
- The field is required: the submit button is disabled until a country is selected. If the player somehow bypasses the client validation, the server rejects the submission with an error referring to the Country field.
- The dropdown lists every country alphabetically by the current UI language's rendering of the country name (English alphabetical order for English UI, Russian for RU, Spanish for ES).
- **Acceptance Criteria:**
  - [ ] Given a visitor is on the sign-up page, when they look at the form, then they see a Country field below the password confirmation.
  - [ ] Given a visitor is on the sign-up page with a filled email, nickname, password, and confirmed password, when they attempt to submit without selecting a country, then the submission is blocked and they see a validation message for the Country field.
  - [ ] Given a visitor types "Mex" into the Country field, when the dropdown filters, then "Mexico" is one of the visible options.
  - [ ] Given a visitor selects "Mexico" and completes sign-up, when their verify-email arrives and they verify + sign in, then their profile shows Mexico with the Mexican flag icon.

### 2.8 Country optional for existing users — "International" display

- A user whose country is NULL is displayed as **"International"** with a **white flag** icon anywhere their profile is rendered (profile page, friend list rows if country is shown there, anywhere else country appears).
- The user is never forced to choose a country. There is no modal prompt at sign-in asking them to pick one. They can set it on the Profile page voluntarily (§2.9).
- **Acceptance Criteria:**
  - [ ] Given an existing user whose country is unset signs in today, when their profile loads, then they see "International" with a white-flag icon in the identity card at the top of the profile.
  - [ ] Given an existing user whose country is unset signs in, when they sign in, then no popup, modal, or banner prompts them to pick a country — they are free to use the app as before.
  - [ ] Given an existing user with no country, when another user views their friend row (or anywhere else the country appears), then it shows "International" + white flag — not a blank space.

### 2.9 Country can be set / changed on the Profile page

- The Profile page gains a Country selector in the identity area at the top. The selector is the same searchable-dropdown-with-flags as the registration form.
- When the player picks a country (or changes an existing one), it saves immediately — no explicit "Save" button needed. A short "Saved" indicator may appear briefly.
- **Acceptance Criteria:**
  - [ ] Given a signed-in player with "International" country is on their Profile page, when they open the Country dropdown and select Spain, then the identity card updates to "Spain" + Spanish flag immediately and the change persists after page reload.
  - [ ] Given a signed-in player with a country of Mexico wants to change it, when they open the Country dropdown and select France, then the identity card updates and the change persists.

### 2.10 Profile page redesign

- The Profile page is organized as:
  - **Identity card** at the top: avatar (placeholder from spec 013 — first letter of nickname), nickname, country selector (with flag + name).
  - **Ratings table** below (unchanged from today's content — Bullet / Blitz / Rapid / Classical rating per mode).
  - **Game history** below the ratings — same list, filters, pagination, replay-click behavior that exists today.
- The identity card uses the project's existing Card visual language (same background, border-radius, padding) so it fits with the rest of the app.
- Avatar is NOT uploadable in this spec. The placeholder (first-letter circle on a hashed-color background) continues to be shown. A tooltip on hover may optionally read "Avatar upload coming soon".
- **Acceptance Criteria:**
  - [ ] Given a signed-in player opens their Profile page, when it loads, then they see an identity card at the top with their avatar placeholder, nickname, and country selector; the ratings table below; and the game history below the ratings.
  - [ ] Given a signed-in player opens their Profile page, when they hover the avatar, then no upload affordance appears — the avatar is display-only in this spec (optional tooltip "Avatar upload coming soon").
  - [ ] Given a signed-in player's country is set to Mexico, when they open their Profile page, then the identity card shows the Mexican flag + "Mexico" next to the nickname.

### 2.11 Localization

- Every new user-facing string in this spec is translated into English, Russian, and Spanish. This includes: Settings/Friends/Chat/Notifications popup contents, "Chat coming soon" + "Learn more", "You're all caught up.", "International", "Country" label on sign-up and Profile, "Sign out" button text inside the Settings popup, "Open full Friends page" link, "No friends yet" + "Find friends".
- Country names in the dropdown render in the current UI language (e.g., "Russia" in English UI, "Россия" in Russian UI, "Rusia" in Spanish UI). This requires a localized country-name map; machine-assisted translations are acceptable (same convention as spec 012 established — RU/ES translations marked for review).
- **Acceptance Criteria:**
  - [ ] Given the current language is Russian, when a signed-in player clicks the Chat icon, then the popup heading reads in Russian (e.g., "Чат скоро появится").
  - [ ] Given the current language is Spanish, when a visitor is on the sign-up page, then the Country field label reads in Spanish and the country names in the dropdown render in Spanish (e.g., "México", "Estados Unidos").
  - [ ] Given the current language is Russian, when a signed-in player opens the Settings popup, then the "Sign out" button reads in Russian ("Выйти").

---

## 3. Scope and Boundaries

### In-Scope

- Four mini-popups anchored to the sidebar icons (Settings / Friends / Chat / Notifications).
- Settings popup containing language, theme, sign-out.
- Removal of standalone Theme toggle, standalone Language selector, and temporary Logout icon from the sidebar bottom (signed-in state only — anonymous bottom unchanged).
- Friends popup with quick list and link to full page.
- Chat popup as a visible "coming soon" placeholder.
- Notifications popup as a UI placeholder (no real data wired).
- Country field on User record (nullable, ISO 3166-1 alpha-2).
- Required Country field on sign-up form (searchable dropdown with flags).
- Optional Country for existing users with "International" + white flag display when unset.
- Country can be set/changed on the Profile page.
- Profile page redesign with identity card (avatar placeholder + nickname + country) + ratings + history.
- Localized country names (EN / RU / ES).
- Localization of all new strings.

### Out-of-Scope

- Real chat / direct-message feature — Chat popup is a visible placeholder, implementation deferred.
- Real notifications wired to backend events (friend requests, challenges, game-end). Notifications popup is a UI placeholder.
- Avatar upload — the placeholder avatar continues; S3 or similar storage infra is a separate future spec.
- Showing country on other users' avatars across the app (friend rows, game-history opponent info, matchmaking previews). Those surfaces may show country in a future amendment; this spec focuses only on the current user's own profile display.
- Forcing existing users to pick a country via modal or banner — out of scope by explicit user decision (optional with "International" fallback).
- GeoIP auto-detection of country at sign-up.
- Changing the sign-up form's existing fields (email, nickname, password rules) — only adding Country.
- Any backend change for notifications or chat.
- Right-to-left layout.
- The anonymous visitor's sidebar bottom section — unchanged.

---

## Change Log

_No amendments yet._
