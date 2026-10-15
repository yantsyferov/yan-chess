# Functional Specification: Visual design and design system

- **Topic:** A unified visual theme for YanChess (dark-first with a light alternative) and its application to the current account pages
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Right now YanChess pages are assembled "out of the box": bare HTML forms, the system font, no colors, borders, or composition. It's a working skeleton, but we can't show it to a player: the product looks like the admin panel of an internal utility, not a platform you'd want to use in the evening.

This feature covers the first point of visual contact with the player — the home page, registration/sign-in/password-reset forms, and the profile — and provides a foundation (colors, fonts, sizes, standard elements) for all future screens, including the game board itself.

**Problem we are solving:** without a recognizable branded look, the player cannot distinguish YanChess from dozens of other free chess sites and doesn't trust the "enter password" form. A beautiful, cohesive interface lifts registration conversion and the perception of the product as something serious — before the player even gets to their first game.

**Direction:** a dark interface by default, light by toggle. The mood is a fresh web reading of the chess theme: a muted dark background, semi-transparent "glass" cards with a soft glow at the edges, an emerald-jade accent that goes deeper in the light theme and glows in the dark one. The classic chess association (wooden board, green felt of tournament tables) is reinterpreted in a modern web visual language.

**How we measure success:**

- In a blind comparison "old form / new form" on a test group of 10 people, the new one must win on "like more", "feels trustworthy", and "looks modern" — **at least 8 out of 10**.
- Share of guests who complete the registration form (fill in all fields and press "Sign up") — **20% higher** compared to the current bare UI (measured on a test group).
- Contrast of text and controls against the background on both themes — meets **WCAG 2.1 AA** (contrast of body text ≥ 4.5:1, of large text and buttons ≥ 3:1).

---

## 2. Functional Requirements (The "What")

### 2.1 Overall visual theme (colors, fonts, sizes)

- **As** a player, **I want** to see the product in a unified dark theme with a soft glow and an emerald accent, **so that** YanChess is recognizable and looks modern.
  - **Dark theme (default):**
    - Background: deep blue-black with a barely visible gradient (even, without visible banding).
    - Cards and panels: transparent/matte glass (like frosted glass over a dark background). The card has a thin gradient border going from light to dark.
    - Primary text: light, but not pure white (doesn't blind the eye).
    - Muted text (captions, hints): the same tone, but dimmer.
    - Accent: emerald-jade (`#10B981` — for primary buttons, active states, focus rings, links). In the dark theme it has a slight edge glow.
    - Error: warm coral (`#F87171` or close), readable on a dark background.
    - Success: the same accent emerald.
  - **Light theme:**
    - Background: very light warm gray, not pure white (a slight "cream" tint, like light wooden squares on a board).
    - Cards: white, with a soft shadow underneath, without "glass".
    - Primary text: dark graphite.
    - Accent: the same emerald, but a bit deeper (`#059669`), without a glow — instead, neat shadows and thick focus borders.
  - **Theme toggle:**
    - In the page header (on the right) — a small moon/sun icon that switches the theme in one click.
    - Default: dark.
    - On first visit — the theme is determined by the player's OS settings; after changing it via the icon the player's choice takes priority.
    - The choice persists between sessions.
  - **Fonts:**
    - Primary: a grotesque with moderate weight (like Inter, Manrope, Satoshi, or similar — example for the designer). Without serifs.
    - For large headings, a slightly denser weight is allowed.
    - Monospaced font — only in the future for chess notation (SAN, PGN), not used in this spec.
  - **Text sizes:**
    - Primary: reads effortlessly at normal screen distance (target — 16px).
    - Page heading (h1): large, visually dominant (target — 32–36px, depending on font weight).
    - Secondary text and field labels: smaller than primary (target — 14px).
  - **Spacing and corners:**
    - Cards and inputs have moderately rounded corners — neither sharp nor fully capsule-shaped (target — 12–16px).
    - Inside cards and between logical groups — generous breathing room (no crowding).
  - **Acceptance Criteria:**
    - [x] Given a player opened the site for the first time in a browser with a light system theme, when the page loads, then they see the light theme.
    - [x] Given a player opened the site for the first time in a browser with a dark system theme, when the page loads, then they see the dark theme.
    - [x] Given a player is on any page, when they click the theme toggle icon in the header, then the interface immediately switches to the opposite theme without reloading the page.
    - [x] Given a player switched the theme and reloaded the page (or came back the next day), when the page loads, then they see the previously chosen theme regardless of the system setting.
    - [x] Given the dark theme is active, when the player looks at primary text and the "Sign in" button, then the contrast of primary text against the background is at least 4.5:1 and of the button at least 3:1.
    - [x] Given the light theme is active, when the player looks at primary text and the "Sign in" button, then the same WCAG AA thresholds are met.

### 2.2 Primary interface elements (buttons, fields, cards)

- **As** a player, **I want** to see the same buttons, fields, and cards on all pages, **so that** the interface feels like one cohesive product.
  - **Primary button (main action on the page — for example "Sign in", "Sign up", "Save password"):**
    - In the dark theme: solid accent emerald fill with a slight surrounding glow.
    - In the light theme: the same fill, a deeper tone, with a short soft shadow underneath.
    - Button text — contrasting, large, with moderate weight.
    - On hover: the color is slightly brighter (dark) / slightly deeper (light), the glow is more noticeable.
    - On press (during click): the button slightly "sinks" (visually lower) to give tactile confirmation.
    - In the "submitting" state (while the action is in progress): the text is replaced with a spinner, the button stays the same size, repeat clicks are ignored.
    - In the "disabled" state: muted, with a not-allowed cursor on hover.
  - **Secondary button (alternative action — e.g. "Cancel", a link to another form):**
    - In both themes: no fill, only an outline in the primary text color. On hover — a light fill of a semi-transparent tone.
  - **Text link (e.g. "Sign in" next to "Already registered?"):**
    - Accent color without underline at rest; underline appears on hover.
  - **Input field (email, nickname, password, etc.):**
    - Outline in a muted tone, semi-transparent background (over the card glass — slightly darker than the glass; on the light theme — slightly darker than the background).
    - Field label — above the field, left-aligned, in a muted color.
    - On focus: the outline switches to accent emerald, with a thin glowing halo around it (dark theme) / a slightly thicker accent border (light theme).
    - On validation error: the outline turns coral, a short error message in coral text appears below the field with a "!" icon.
    - The password field additionally shows an eye icon on the right inside the field — clicking it reveals/hides the entered password.
  - **Card/panel (common wrapper for forms, profile, informational blocks):**
    - In the dark theme: semi-transparent matte-glass background, a soft gradient border (thin, barely visible), a small outer shadow.
    - In the light theme: white background, a soft shadow underneath the card, a thin gray border.
    - Corners moderately rounded.
    - Inside the card — a vertically centered layout by default (heading, then fields, then button at the bottom).
  - **Form-level error message (not field-level — e.g. "This email is already registered"):**
    - A separate block above the form, with a coral left bar or background, with a "!" icon and a short textual hint.
  - **Success message:**
    - The same block, but with an emerald bar and a "✓" icon.
  - **Acceptance Criteria:**
    - [x] Given the player opened the registration page, when they click in the email field and start typing, then a glowing accent border appears around the field.
    - [x] Given the player submitted a form with empty fields, when validation errors appear, then the outline of each errored field turns coral, and the error text appears below the field.
    - [x] Given the player hovers over the primary button, when they hold the cursor, then the button color becomes noticeably brighter (dark) / noticeably deeper (light) and the glow/shadow around the button becomes stronger.
    - [x] Given the player pressed the primary button and the form is submitting, when the request has not yet finished, then a spinner replaces the text on the button and repeat clicks do nothing.
    - [x] Given the player opened the form in the dark theme, when they look at the text link "Forgot password?", then it is emerald without underline; on hover an underline appears.
    - [x] Given the player enters a password on the registration page, when they click the eye icon in the password field, then the entered characters become visible; on a second click they are hidden again.

### 2.3 Page header

- **As** a player, **I want** to see the same header on all pages, **so that** I always understand where I am and in what state.
  - **For a guest (not signed in):**
    - YanChess logo/name on the left (clickable, leads to the home page).
    - On the right — "Sign in" link, "Sign up" link, theme toggle icon.
  - **For a signed-in player:**
    - Logo on the left.
    - On the right — the player's nickname with a small colored placeholder avatar next to it (a circle with the first letter), theme toggle icon.
    - Clicking the nickname opens a menu with the items: "Profile", "Sign out".
  - **The header stays visible on scroll** (sticky at the top of the page). On the dark theme the header gets a soft semi-transparent background with blur on scroll (to separate it from the content below).
  - **Acceptance Criteria:**
    - [x] Given a guest is on any page, when they look at the header, then they see the "YanChess" logo on the left and "Sign in", "Sign up", and the theme icon on the right.
    - [x] Given a player is signed in and is on any page, when they look at the header, then they see their nickname with a placeholder avatar and the theme icon instead of the "Sign in"/"Sign up" links.
    - [x] Given a signed-in player opened the header, when they click their nickname, then a menu appears with the items "Profile" and "Sign out".
    - [x] Given the player scrolls a long page down, when the page has scrolled, then the header remains pinned to the top of the viewport and gains a soft semi-transparent background.

### 2.4 Application to each current page

- **As** a player, **I want** all account pages (home, registration, sign in, email confirmation, password reset, profile) to look in one consistent brand style, **so that** transitions between them don't feel like transitions between different sites.
  - **Home (/):**
    - For a guest: a large heading "YanChess", a short subtitle/slogan ("Chess online in one click" or similar — the exact wording comes from product), two large buttons side by side — "Sign in" (primary) and "Sign up" (secondary). The whole block is centered in a card over the main background.
    - For signed-in: the same header balance, but instead of the buttons — a large card with the heading "Hi, `nickname`!" and a big "Find game" button (leads to a stub, matchmaking is out of scope for this feature).
  - **Form pages (/register, /login, /forgot-password, /reset-password):**
    - A unified AuthLayout wrapper: the page fills the viewport, in the center — a single card with the form. Above the card — a page title, below the card — a textual hint link (for example, on /register towards /login: "Already have an account? Sign in").
    - On the dark theme the background behind the card is a gradient with a very subtle chessboard square texture (very muted).
  - **/verify-email/check:**
    - A card, a large "envelope" icon, heading "Check your email", in the body — the player's email, a line "Link is valid for 24 hours", a "Resend" link (disabled for now, will come in a future feature).
  - **/verify-email?token=…:**
    - While the request is in flight: a card with the line "Verifying email…" and a spinner.
    - Success: a card with a "✓" icon (emerald), heading "Email verified", "Sign in" button.
    - Failure: a card with a "!" icon (coral), heading "Link is invalid", "Sign in" button and a link to /forgot-password to request a new one.
  - **/profile:**
    - Profile card: a large placeholder avatar, nickname, registration date.
    - Below — a "Rating" section: 4 rows (Bullet / Blitz / Rapid / Classical), each with a large rating number, under which a small muted line shows the number of games played. Thin dividers between rows.
    - At the bottom of the card — a secondary "Sign out" button (doesn't draw attention like a primary filled button would).
  - **All forms: unified validation behavior.** Validation errors appear below the fields or above the form (depending on type), in the unified style defined in §2.2. No separate error styles on different pages.
  - **Acceptance Criteria:**
    - [x] Given a guest opened the home page `/`, when the page loaded, then they see the heading "YanChess", a subtitle, two large "Sign in" and "Sign up" buttons in the center of the screen.
    - [x] Given a guest opened the registration page `/register`, when the page loaded, then they see a single centered card with the form, a "Sign up" heading above it, and the link "Already have an account? Sign in" below it.
    - [x] Given a player after registration lands on `/verify-email/check`, when they look at the card, then they see an envelope icon, the heading "Check your email", their email in the body, and a line about the link's validity.
    - [x] Given a player followed a correct verification link, when the page loaded and the request succeeded, then they see an icon with a green checkmark, the heading "Email verified", and a "Sign in" button.
    - [x] Given a player followed an expired link, when the page loaded and the request returned an error, then they see an icon with an exclamation mark, the heading "Link is invalid", a "Sign in" button, and a link to the password-reset page.
    - [x] Given a signed-in player opened `/profile`, when the page loaded, then they see a card with a placeholder avatar, nickname, registration date, a table of four ratings (Bullet/Blitz/Rapid/Classical with a number and a game count), and a secondary "Sign out" button at the bottom.
    - [x] Given the player is on `/login` and `/register`, when they open both pages in turn, then the styling of cards, buttons, fields, colors, and fonts is identical — visually the pages feel like part of one product.

### 2.5 Behavior at different screen sizes

- **As** a player, **I want** pages to render correctly on a phone and on a laptop, **so that** I can sign in from any device.
  - On narrow screens (width < 640px):
    - The form card takes almost the full width of the screen with small side margins.
    - The header compresses: instead of the text links "Sign in"/"Sign up" for a guest — a "menu" icon that opens a drawer with the same items.
    - Font size and controls stay comfortable to tap with a finger (buttons — no smaller than 44×44 pixels of effective tap area).
  - On wide screens (laptop/desktop):
    - The form card has a fixed maximum width (target — 440px) and is centered.
    - The header shows all items on a single row.
  - **Acceptance Criteria:**
    - [x] Given a player opens `/login` on a phone with a screen width of 375px, when the page loaded, then the form card takes almost the full width (with small side margins), all fields and the button remain comfortable to tap, and no text is clipped.
    - [x] Given a player opens `/login` on a laptop with a screen width of 1440px, when the page loaded, then the form card has a limited max width and is centered on the screen, not stretched to full width.
    - [x] Given a guest opened the home page on a narrow screen, when they look at the header, then instead of the "Sign in"/"Sign up" text links they see a menu icon; clicking it opens a drawer with those items.

### 2.6 Accessibility by keyboard and for users with special needs

- **As** a player using a keyboard or a screen reader, **I want** to use the forms freely, **so that** my limitations don't stop me from playing.
  - Pressing Tab moves focus sequentially through all form fields and buttons in a logical order.
  - On every focused element (field, button, link, theme toggle, profile menu) a clear accent border is visible — the same emerald accent, not the default gray system ring.
  - All fields have labels associated with them — a screen reader announces which field is focused.
  - Validation errors are announced to screen readers (role "alert") — the player hears the error without searching for it visually.
  - **Acceptance Criteria:**
    - [x] Given the player opened the registration form and the cursor isn't on anything, when they press Tab, then focus moves to the first field (Email), the next Tab — to the Nickname field, and so on down to the "Sign up" button.
    - [x] Given the player focused any input field with Tab, when they look at the screen, then an accent border is visible around the field (not the default system gray).
    - [x] Given the player uses a screen reader and focuses the Email field, when the screen reader announces the page content, then it says "Email" (the field label).
    - [x] Given the player submitted a form with errors and uses a screen reader, when the errors appear, then the screen reader announces the error text immediately, without the need to move focus to the message manually.

---

## 3. Scope and Boundaries

### In-Scope

- Unified design tokens: colors (dark + light themes), fonts and their sizes, spacing, radii, shadows, glows, glass effects.
- Common visual elements: buttons (primary/secondary), text links, input fields (including password with eye icon), checkboxes, cards/panels, dividers, error/success messages.
- Common header (sticky, with the theme toggle and the profile menu for signed-in users).
- AuthLayout — a shared wrapper for form pages.
- Theme toggle (dark/light) in the header, with persistence and system-theme detection on first visit.
- Applying unified styling to all pages built in the `001-registration-and-login` feature: `/`, `/register`, `/login`, `/verify-email/check`, `/verify-email`, `/forgot-password`, `/reset-password`, `/profile`.
- Support for narrow screens (mobile browsers) and wide screens (laptop/desktop) for the listed pages.
- Keyboard and screen-reader accessibility on the same pages.

### Out-of-Scope

- The visual appearance of the chess board, pieces, move animations, clocks, game panel — subject of a separate "game board" spec.
- The visual appearance of the matchmaking and waiting-queue page — subject of a separate spec.
- Illustrations, branded icons, final designer-quality logo (simple geometric icons from an open set are used; artistic work on the logo and illustrations — a separate task).
- Animations beyond micro-interactions (card appear/disappear, smooth hovers, focus glow). Full-fledged fluid transitions between pages, parallax effects — not in this feature.
- Native mobile apps — web only.
- Support for Internet Explorer and legacy browsers without modern CSS capabilities.
- Content text (slogans, subtitles on the home page) — a separate copywriting task; placeholder phrasing is acceptable in this feature.

---

## Change Log

_No amendments yet._
