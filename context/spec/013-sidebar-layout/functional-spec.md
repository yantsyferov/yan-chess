# Functional Specification: Sidebar Layout

- **Topic:** Replace the horizontal top-of-page header with a vertical left sidebar that stays visible across all main pages, hide the sidebar entirely on the five authentication-flow pages (sign in, sign up, verify email, forgot password, reset password), and change the language switcher to show the current language as a full word in its own alphabet ("English", "Русский", "Español").
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Today YanChess uses a thin horizontal top bar for every destination link, language, theme and account access. As the product grows the number of entry points will grow with it: besides Play, players will want shortcuts to Friends, Settings, Notifications, and more. The horizontal header crams everything into one row and ran out of room already — on narrower screens the links overflow and the account dropdown is the only way to reach anything.

A vertical sidebar on the left is the familiar pattern players know from chess.com, Discord, Slack: it anchors the brand at the top, groups navigation items in the middle, and reserves the bottom for identity (sign in / sign up for guests, avatar + account tools for members). It scales as new items are added, keeps the content area wide and uncluttered, and makes the identity area always available regardless of where the player is in the app.

A second concern is the authentication flow. When a visitor is signing up or resetting a password, the full navigation is a distraction — they are doing one thing and they need the one thing to be the whole page. Login, Sign up, Verify email, Forgot password and Reset password therefore drop the sidebar entirely in favor of a clean full-page centered form.

The language switcher is also updated: instead of a two-letter code (`EN` / `RU` / `ES`) the current language is shown as its full endonym — "English", "Русский", "Español". This is a direct feedback improvement after spec 012 shipped — the code is quick to parse once you know the convention, but a new visitor who speaks Spanish and lands on an English page recognizes "Español" faster than "ES" in a sea of unfamiliar text.

**Success is measured by:**
- A visitor can reach every current destination in one click from any main-app page via the sidebar.
- A visitor on the sign-in or sign-up page sees only the form — no sidebar, no header, no navigation chrome.
- A Russian or Spanish speaker scanning the language option sees their language's name in their own alphabet before they recognize any English.
- The sidebar is reachable and usable on a phone-sized viewport.

---

## 2. Functional Requirements (The "What")

### 2.1 Sidebar presence and visibility by route

- Every main-app page (home, Play, Profile, History, Friends, Hotseat game, Vs-bot game) renders a sidebar fixed to the left of the viewport. Content shifts right to leave the sidebar fully visible.
- The sidebar is **not shown** on the five auth-flow pages: sign in, sign up, verify email, forgot password, reset password. These pages render as a full-width centered form on an otherwise blank background.
- The top horizontal header that exists today disappears across the whole product.
- **Acceptance Criteria:**
  - [x] Given the visitor is on the home page, when it loads, then they see a vertical sidebar on the left and no horizontal header at the top.
  - [x] Given the visitor is on the Play page, when it loads, then the sidebar is visible on the left.
  - [x] Given a signed-in user is on their Profile page, when it loads, then the sidebar is visible on the left.
  - [x] Given the visitor opens the sign-in page, when it loads, then the sidebar is NOT visible — only the sign-in form on an otherwise clean background.
  - [x] Given the visitor opens the sign-up page, when it loads, then the sidebar is NOT visible.
  - [x] Given the visitor opens any of the three email-flow pages (verify email, forgot password, reset password), when they load, then the sidebar is NOT visible.

### 2.2 Sidebar structure — top (logo) and middle (menu)

- At the top of the sidebar sits the **YanChess logo**, clickable, taking the visitor to the home page. The logo is the same visual on every page.
- Below the logo, in the middle section, sits the main navigation menu. For this version the menu contains **one item**: **Play**, with an icon, that routes to the Play page.
- The menu area is prepared to receive additional items in the future (Profile, History, Friends, etc.) without rearranging the sidebar's structure — the slot for additional items is simply empty right now.
- The currently-active route is highlighted on the matching menu item (e.g., a slightly brighter background or a filled icon) so the visitor can tell at a glance which page they are on.
- **Acceptance Criteria:**
  - [x] Given the visitor is anywhere in the main app, when they click the YanChess logo at the top of the sidebar, then they land on the home page.
  - [x] Given the visitor is anywhere in the main app, when they click the Play menu item in the sidebar, then they land on the Play page and the Play item is visually highlighted as the current page.
  - [x] Given the visitor is on the Play page, when the sidebar renders, then the Play menu item is visually marked as the active item.

### 2.3 Sidebar bottom section — anonymous (not signed in)

- When no one is signed in, the bottom section of the sidebar contains, in order from top to bottom:
  1. A **Login** button that routes to the sign-in page.
  2. A **Register** button that routes to the sign-up page.
  3. A **Theme toggle** (same binary dark/light control that exists today in the header).
  4. A **Language selector** that displays the current language as a full word in its own alphabet ("English", "Русский", or "Español"). Clicking it opens a dropdown listing all three languages — same picker as today, same localStorage persistence — only the closed-state label changes from a two-letter code to the full endonym.
- The Login and Register buttons are visually distinct from each other (one filled, one outlined) so the "sign up" call-to-action can be more prominent, but both are reachable at any time.
- **Acceptance Criteria:**
  - [x] Given no one is signed in, when the sidebar renders, then its bottom section shows Login, Register, Theme toggle, and the Language selector in that order.
  - [x] Given no one is signed in, when the visitor clicks Login in the sidebar, then they land on the sign-in page with no sidebar visible there.
  - [x] Given no one is signed in, when the visitor clicks Register in the sidebar, then they land on the sign-up page with no sidebar visible there.
  - [x] Given the current language is Spanish, when the visitor looks at the Language selector in the sidebar, then its closed state displays "Español" (not "ES").
  - [x] Given the current language is Russian, when the visitor looks at the Language selector in the sidebar, then its closed state displays "Русский".
  - [x] Given the current language is English, when the visitor looks at the Language selector, then it displays "English".

### 2.4 Sidebar bottom section — signed in

- When a user is signed in, the bottom section replaces the Login / Register pair with the user's identity + action icons. From top to bottom:
  1. **Avatar + nickname row** — the user's circular avatar next to their nickname text. Clicking anywhere on the row routes to that user's Profile page.
  2. A row of **four action icons**, left to right: **Settings**, **Friends**, **Chat**, **Notifications**. Each is an icon-only button with a tooltip on hover showing the icon's name.
     - In this version, clicking **Settings**, **Friends**, or **Notifications** does nothing visible — they are placeholders. The icons must be visibly rendered as clickable but no mini-popup opens yet (that behavior arrives in spec 015).
     - **Chat** is rendered as **visibly disabled** (greyed out, no hover effect, cursor shows the browser's "not-allowed" state), to signal to the user that the feature is on the roadmap but not yet available. Clicking it does nothing.
  3. A **Theme toggle** (same as the anonymous view — binary dark/light switch).
  4. A **Language selector** (same as the anonymous view — full-word endonym).
- The avatar is a circular image. If the user has no avatar uploaded, a stable placeholder (e.g., the first letter of their nickname on a solid background) is shown — same placeholder convention the product uses today.
- **Acceptance Criteria:**
  - [x] Given a signed-in user is on any main-app page, when the sidebar renders, then its bottom section shows avatar + nickname, the four action icons (Settings, Friends, Chat, Notifications), Theme toggle, and Language selector in that order.
  - [x] Given a signed-in user is on any main-app page, when they click their avatar or nickname in the sidebar, then they land on their Profile page.
  - [x] Given a signed-in user has no avatar uploaded, when the sidebar renders, then they see a placeholder avatar (e.g., the first letter of their nickname) in that slot.
  - [x] Given a signed-in user is on any main-app page, when they click the Settings icon, then nothing happens on screen (the icon registers the click but no popup opens — that behavior arrives in a later version).
  - [x] Given a signed-in user is on any main-app page, when they click the Friends icon, then nothing happens on screen.
  - [x] Given a signed-in user is on any main-app page, when they click the Notifications icon, then nothing happens on screen.
  - [x] Given a signed-in user is on any main-app page, when they look at the Chat icon, then it is visibly disabled (greyed out) and clicking it does nothing.
  - [x] Given a signed-in user is on any main-app page, when they hover any of the four action icons, then a tooltip shows the icon's name ("Settings" / "Friends" / "Chat" / "Notifications") — translated to the current language.

**Note:** sign-out is covered separately in §2.5 — a fifth icon in the same row.

### 2.5 Sign out from the sidebar in this version

- Deleting the current top header removes the only visible sign-out control the product has today. To avoid a usability regression, the sidebar's signed-in bottom section includes a **temporary** "Sign out" action — rendered as a fifth action icon in the same row as Settings / Friends / Chat / Notifications. Clicking it signs the user out and returns them to the sign-in page.
- This Sign-out icon is explicitly **temporary** for the 013 → 015 window. When the Settings popup lands in spec 015, Sign out moves into the popup alongside Theme and Language, and this fifth icon is removed from the sidebar.
- **Acceptance Criteria:**
  - [x] Given a signed-in user is on any main-app page, when they look at the sidebar, then they see a "Sign out" icon next to the four other action icons.
  - [x] Given a signed-in user clicks the Sign-out icon, when the sign-out completes, then they land on the sign-in page with the sidebar hidden (per the auth-route rule) and the next main-app visit shows the anonymous bottom section (Login + Register).
  - [x] Given a signed-in user hovers the Sign-out icon, when the tooltip appears, then it reads the current language's label for "Sign out" (e.g., "Sign out" / "Выйти" / "Cerrar sesión").

### 2.6 Mobile and narrow viewports

- On a viewport narrower than 768 pixels (phone-sized), the sidebar remains reachable but does not take permanent screen real estate — the exact mechanism is left to the implementation (the visible promise is simply "navigation is reachable without leaving the current page").
- On a viewport 768 pixels or wider (tablet / desktop), the sidebar is permanently visible in its full form.
- **Acceptance Criteria:**
  - [x] Given a visitor is on a 1280-pixel-wide desktop viewport, when any main-app page renders, then the sidebar is permanently visible on the left and the page content is fully visible to its right.
  - [x] Given a visitor is on a 375-pixel-wide phone viewport, when any main-app page renders, then they can reach every item in the sidebar — logo, Play, bottom section — through at most one tap, without the sidebar permanently blocking the main content area.
  - [x] Given a visitor is on a 375-pixel-wide phone viewport on the sign-in page, when the page renders, then the sidebar is NOT present (the sign-in form takes the full width minus comfortable margins).

### 2.7 Theme toggle and language switcher move location without changing behavior

- The Theme toggle and the Language selector both move from the current top header into the sidebar's bottom section. Their behavior is unchanged — same click-to-switch, same persistence of the user's choice between visits.
- The Language selector gains one visible change: its closed state shows the full endonym ("English" / "Русский" / "Español") instead of the two-letter code. Inside the dropdown each option continues to show only the endonym (no flag, no inline abbreviation), with the currently-active row marked by a checkmark on its right — same pattern that exists today.
- **Acceptance Criteria:**
  - [x] Given a visitor was reading the product in Russian yesterday, when they open the site again today, then it opens in Russian (unchanged persistence behavior).
  - [x] Given a visitor is in the sidebar, when they switch the theme from dark to light, then the whole product's theme switches to light and the switch persists on reload (unchanged behavior).

### 2.8 Language and theme labels are localized

- All text labels in the sidebar — the Play menu item, Login, Register, the four action icon tooltips, the Theme toggle's hover tooltip, the dropdown items of the Language selector — are translated into the active language (English, Russian, Spanish).
- **Acceptance Criteria:**
  - [x] Given the current language is Russian, when the visitor looks at the sidebar, then the Play menu label reads "Играть" (or the project's chosen Russian word for Play).
  - [x] Given the current language is Spanish, when the visitor hovers the Settings icon, then the tooltip reads "Ajustes" (or the project's chosen Spanish label).
  - [x] Given the current language is Russian, when the anonymous visitor opens the sidebar, then the Login and Register buttons read "Войти" and "Регистрация" (the same strings used today on those actions elsewhere in the product).

---

## 3. Scope and Boundaries

### In-Scope

- A single, left-anchored vertical sidebar visible on every main-app page.
- Clickable logo at the top of the sidebar routing to home.
- One menu item ("Play") in the middle section, with the layout prepared to accept more items later.
- Anonymous bottom section: Login button, Register button, Theme toggle, Language selector (full-word format).
- Signed-in bottom section: avatar + nickname row (clickable → Profile), four placeholder action icons (Settings, Friends, Chat disabled, Notifications), Theme toggle, Language selector.
- Removal of the current top horizontal header from the entire product.
- Hiding the sidebar on the five auth-flow pages (sign in, sign up, verify email, forgot password, reset password).
- Change of the language switcher's closed-state label from a two-letter code ("EN" / "RU" / "ES") to the current language's full endonym ("English" / "Русский" / "Español").
- Localization of every new sidebar label into all three supported languages.
- A navigation experience that remains usable on a 375-pixel-wide phone viewport.

### Out-of-Scope

- The Settings mini-popup (containing theme, language, logout) — spec 015.
- The Friends mini-popup (containing friend list + link to the full /friends page) — spec 015.
- The Chat mini-popup (and any related chat feature) — not planned for this release; the icon shows a disabled state.
- The Notifications mini-popup (containing recent events) — spec 015.
- The Profile page redesign (country field, extended history, avatar edit) — spec 015.
- The Country field on the user record — spec 015.
- The Play page redesign itself (non-clickable board + four-mode cards) — spec 014.
- The /game/online/friend route (board + friends panel) — spec 014.
- The rated / unrated game toggle — spec 014.
- Right-to-left (RTL) language layout support — project-wide out-of-scope.
- Any change to how a user signs out — the sign-out mechanism that exists today continues to work; a sidebar-level sign-out entry is deferred to spec 015's Settings popup.

---

## Change Log

- **[2026-10-16]** — `/awos:tech` amend — §2.5 (sign-out) rewritten after tech review surfaced a UX regression: deleting the current Header removes the only visible sign-out control. Original §2.5 said "no sign-out button in the sidebar"; amended version adds a **temporary** fifth action icon ("Sign out") in the signed-in bottom row, explicitly scheduled for removal when spec 015's Settings popup absorbs it.
- **[2026-10-16]** — `/awos:verify` — all 34 acceptance criteria marked complete. Visual criteria verified via Playwright drive against web preview on port 5173 (CORS-allowed origin for dev-API on 3000). Screenshots at `docs/screenshots/013-sidebar-*.png`: `slice1-endonym`, `desktop-anon`, `auth-page-no-sidebar`, `mobile-hamburger-closed`, `mobile-drawer-open`, `desktop-signed-in-ru` (signed in as alice via dev-API), `play-active-highlight`, `anon-ru-game-page`. Signed-in flow proved end-to-end: sign-in → signed-in bottom with avatar + 5 icons + RU labels → navigate /play → `aria-current="page"` on Play link → click Logout icon → landed on /login with sidebar hidden. Non-visual logic criteria (§2.7 persistence, §2.6 narrower-than-375px edge cases) covered by the 55-test FTR suite at `apps/web/src/__tests__/sidebar-layout.spec-013.test.tsx` + the dedicated per-slice tests (393 web tests total, all green on branch).
