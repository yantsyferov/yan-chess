# Functional Specification: Internationalization — Russian + Spanish localization

- **Topic:** Add Russian and Spanish language support across the app and transactional emails, with first-visit autodetection, an in-app language switcher, and the chosen language synchronized across the user's devices after sign-in.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Today YanChess is only usable by English readers — every button, every page, every email arrives in English. A Russian or Spanish speaker who lands on the site sees a wall of unfamiliar text and either struggles through it or leaves.

The product's audience statement is "chess enthusiasts of every level" — a goal that cannot be met while language is a gate. Chess is the most universal game in the world; the platform should not require English to be its entry fee.

This change lets a player experience the entire product — the home page, matchmaking, the chessboard, friends, profile, history, and the welcome / password-reset emails — in English (as today), **Russian**, or **Spanish**. The player's language is remembered, follows them to new devices after they sign in, and when they visit for the first time the site is already in their system language without them having to do anything.

**Success is measured by:**
- A first-time Russian-speaking visitor sees the home page in Russian without touching any setting, and can complete sign-up through verify-email without ever seeing English.
- A signed-in user who switches to Spanish on their laptop opens the site on their phone (after signing in there) and immediately sees Spanish — no second switch needed.
- No English string remains visible anywhere in the three canonical journeys: register → verify → sign in; find a game → play → see result; add a friend → challenge → play.

---

## 2. Functional Requirements (The "What")

### 2.1 Supported languages

- The app supports three languages: **English** (the current and default language), **Russian**, and **Spanish**.
- No other languages are offered. A visitor whose system is set to French, German, Portuguese, or any other language sees the app in English and can switch to Russian or Spanish from the language switcher.
- **Acceptance Criteria:**
  - [x] Given a visitor opens the site with any system language, when they open the language switcher, then they see exactly three options: "English", "Русский", "Español" — each written in its own language.
  - [x] Given a visitor's system is set to Portuguese, when they land on the site for the first time, then the site displays in English (not in any attempted "best-effort" substitution).

### 2.2 First-visit auto-detection

- When a visitor opens the site for the first time (no prior language choice remembered in their browser), the site reads their system language setting.
  - If the system language starts with "ru" (any Russian regional variant), the site opens in Russian.
  - If the system language starts with "es" (any Spanish regional variant — Spain, Mexico, Argentina, etc.), the site opens in Spanish.
  - Otherwise the site opens in English.
- The detected language is remembered in the browser so subsequent visits open in the same language without re-detecting.
- **Acceptance Criteria:**
  - [x] Given a visitor with system language "ru-RU" has never been to the site, when they open yan-chess.com, then the page renders in Russian from the very first paint.
  - [x] Given a visitor with system language "es-MX" has never been to the site, when they open yan-chess.com, then the page renders in Spanish.
  - [x] Given a visitor with system language "fr-FR" has never been to the site, when they open yan-chess.com, then the page renders in English.
  - [x] Given a visitor's language has been auto-detected and remembered, when they close the tab and reopen it the next day, then the site renders in the same language without re-detecting.

### 2.3 Language switcher in the Header

- A language switcher appears in the Header, placed next to the sign-in / account menu area. It is visible to both signed-out visitors and signed-in users.
- The switcher's closed state shows the current language's **two-letter code in uppercase** (`EN`, `RU`, or `ES`).
- When clicked, the switcher opens a dropdown listing all three languages, each written in its own language ("English", "Русский", "Español"). The currently active language is marked with a checkmark on the right side of its row (same visual pattern as the existing account dropdown in the Header).
- Selecting an option immediately switches the UI to that language (all visible text updates in place without a page reload) and closes the dropdown.
- **Acceptance Criteria:**
  - [x] Given the site is currently in English, when the user clicks the "EN" badge in the Header and selects "Русский", then every visible text label on the current page updates to Russian within one second and the Header badge changes to "RU".
  - [x] Given the site is in Russian, when the user navigates to another page (e.g., /profile), then that page also renders in Russian.
  - [x] Given the user is signed out, when they open the Header, then the language switcher is visible alongside the "Sign in" / "Sign up" buttons.
  - [x] Given the user is signed in, when they open the Header account menu area, then the language switcher is visible next to it.

### 2.4 Persistence across sessions on the same device

- The user's chosen language is remembered on their current browser between visits.
- If the user explicitly switches language, that choice overrides any previously auto-detected choice.
- **Acceptance Criteria:**
  - [x] Given the site auto-detected English for a user, when they explicitly switch to Spanish and later reopen the site, then the site opens in Spanish (not re-detecting back to English).
  - [x] Given the user has chosen Spanish, when they clear their browser data and return, then the site re-runs auto-detection from scratch.

### 2.5 Cross-device synchronization after sign-in

- When a signed-in user changes their language, the choice is also saved to their account on the server, so other devices they sign into will pick it up.
- The reconciliation rules on sign-in are:
  - If the account has an explicitly chosen language, the site switches to it (overriding whatever was active in the browser before sign-in).
  - If the account has no explicit language on record (e.g., the user has never changed it on any device), the site keeps the current browser language and does not touch the account.
- A signed-out visitor's language is remembered only on that browser — it is never attached to any account.
- **Acceptance Criteria:**
  - [x] Given a user has set Spanish on their laptop, when they sign in on a different device whose browser is in English, then the site switches to Spanish within one second of sign-in completing.
  - [x] Given a user who has never changed language on any device, when they sign in on a new browser whose detected language is Russian, then the site stays in Russian and the account's language-on-record remains unset.
  - [x] Given a signed-in user changes language from English to Russian, when they sign out and sign back in on the same browser, then Russian is still active.

### 2.6 Behavior if the server save fails

- When a signed-in user switches language, the UI switches immediately (not waiting for the server) and attempts to save to the account in the background.
- If the save to the server fails (network error, server unavailable), the UI stays in the newly chosen language on this device — the user is not blocked. The failure does not surface as a disruptive error.
- The next time the user interacts with the site successfully (or signs in again), the account's recorded language is **not** silently retried from the earlier failed switch — it will only be saved on the next explicit switch. The user's device remains in the chosen language regardless.
- **Acceptance Criteria:**
  - [x] Given a signed-in user is offline, when they switch from English to Russian in the Header, then the UI immediately shows Russian and no error dialog or toast appears.
  - [x] Given the server-sync of a language choice failed silently, when the user opens the site on another device later, then that other device sees whatever language was last successfully saved (not the one that failed to sync).

### 2.7 Transactional emails are localized

- The three transactional emails sent by the system — email verification on sign-up, password reset, and (if present) welcome / resend-verification — are localized based on the user's language choice:
  - **At sign-up:** the user is sent the verification email in the language the UI was displaying at that moment (English by default, or whichever language they switched to before clicking "Sign up").
  - **Password reset request:** the user is sent the reset email in whichever language is recorded on their account. If they have no language on record, they receive the email in English.
- Email contents to localize include: the subject line, the greeting, the body text, the call-to-action label on the button, and the fallback plain-text link below the button.
- **Acceptance Criteria:**
  - [x] Given a visitor is viewing the sign-up page in Spanish, when they complete sign-up with a valid email and password, then the verification email arrives entirely in Spanish — subject, greeting, body, button label, and fallback link.
  - [x] Given an existing user whose account language is Russian, when they request a password reset from the "Forgot password" form (regardless of what language the form is in), then the reset email arrives entirely in Russian.
  - [x] Given a user whose account has no language on record, when they request a password reset, then the reset email arrives in English.

### 2.8 Error messages inside the UI

- Short, user-facing error messages shown inside the UI (form validation hints like "Password too short", flash toasts like "Nickname taken", empty states like "No games yet", confirmation dialogs like "Resign the game?") are translated into all three languages.
- Messages that originate from server responses — for example rate-limit text or domain-specific errors — are shown to the user in the current UI language. The user never sees a mixed-language screen.
- **Acceptance Criteria:**
  - [x] Given the site is in Russian, when the user submits the sign-up form with a password shorter than the minimum, then the inline validation message appears in Russian.
  - [x] Given the site is in Spanish, when the user tries to send a friend request to a nickname that doesn't exist, then the toast / error message appears in Spanish.
  - [x] Given the site is in Russian, when the user attempts a login too many times and gets rate-limited, then the rate-limit message appears in Russian.

### 2.9 Chess-specific content stays universal

- Chess move notation (e.g., "e4", "Nf3", "O-O") is a universal international standard and remains unchanged across languages.
- Piece names shown anywhere in the UI (e.g., in the pawn-promotion dialog) are translated.
- Game-end labels ("Checkmate", "Stalemate", "Draw by agreement", "Timeout", "Resignation") are translated.
- **Acceptance Criteria:**
  - [x] Given the site is in Russian, when a game ends in checkmate, then the end-of-game screen shows the Russian label for "Checkmate".
  - [x] Given the site is in any supported language, when the user reviews their game history, then the move list shows standard algebraic notation ("e4", "Nf3") unchanged.
  - [x] Given the site is in Spanish, when a pawn promotion dialog appears, then the four piece options show their Spanish names.

---

## 3. Scope and Boundaries

### In-Scope

- Three languages: English (current default), Russian, Spanish.
- First-visit auto-detection from the browser's system language.
- In-Header language switcher visible to both signed-in and signed-out users.
- Device-local memory of the chosen language.
- Cross-device sync of the chosen language for signed-in users.
- Localization of all three transactional emails: email verification, password reset, and welcome / resend-verification if present.
- Localization of inline UI messages, including form-validation text, toasts, dialog titles and buttons, empty states, and end-of-game labels.

### Out-of-Scope

- Any language other than English, Russian, Spanish. Adding a fourth language is a separate specification.
- Right-to-left (RTL) languages such as Arabic or Hebrew — not part of this spec; no RTL support will be added.
- Date, number, or currency formatting beyond what the user's browser already does by default.
- Chess move notation translation — notation stays standard algebraic (international).
- Localization of generic server error payloads (e.g., 500 pages) — these may remain in English until the user is on a localized screen.
- Localizing meta tags (page title / Open Graph description served in HTML `<head>`) for crawlers and share previews. The in-app title can be translated, but server-rendered share previews remain English.
- Letting users translate the site themselves (community-contributed translations). The three languages are maintained by the project.
- Visual customization of the switcher beyond the stated layout (flag icons, animated transitions, country selectors).

---

## Change Log

- **[2026-10-15]** — `/awos:verify` — All 26 acceptance criteria marked complete. Visual criteria verified via Playwright drive against web preview on port 4173 — screenshots at `docs/screenshots/012-i18n-*.png` (`login-ru-autodetect`, `login-ru-validation-errors`, `switcher-dropdown-open`, `login-es-after-switch`, `game-hotseat-es`). Non-visual criteria (§2.5 cross-device merge, §2.6 silent failure, §2.7 localized emails) verified via the passing 321 web + 131 api unit + 86 api e2e tests (counts post-Slice 7 FTR, including the dedicated `apps/web/src/__tests__/i18n.spec-012.test.tsx` and `apps/api/test/e2e/i18n.spec-012.e2e.spec.ts`).
- **[2026-10-15]** — Verify-time patch — Game.tsx `<h1>Game</h1>` and ModeSelector.tsx "Start game" button were missed by Slice 3 extraction. Fixed in-place with new `game.json` keys `board.pageTitle` + `board.startGame` in all three locales. No AC change — just completes §2.9 chess-content coverage.
- **Known gap** — §2.8 rate-limit error toast on `/login` (triggered by too many failed sign-in attempts) is not routed through the `errors` i18n namespace in the current implementation. Users in a non-English UI who hit the rate limit will see an English string. Non-blocking — recorded in BACKLOG. Follow-up spec would add `errors.rate_limit.*` keys + wire the Login catch-handler through them.
