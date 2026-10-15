# Tasks: Visual Design Foundation (`002-visual-design-foundation`)

Vertical slices of the visual redesign. After each slice the whole app must be startable (`pnpm --filter api dev`, `pnpm --filter web dev`), the previous feature (auth) must keep working, and the slice's new user-visible value verifiable in a browser.

Agents referenced in `**[Agent: ...]**` live in `.claude/agents/`. QA agent for the final regression slice: `testing-expert`.

---

- [x] **Slice 1: Design foundation — Tailwind v4, tokens, dark body, FOUC-safe theme attribute**

  > After this slice, every page opens with the new dark background and Inter font. Theme attribute is set synchronously before React mounts (no flash). Existing forms still work, but they're not restyled yet.

  - [x] Task: Add dependencies to `apps/web/package.json`: `tailwindcss@^4`, `@tailwindcss/vite`, `@fontsource-variable/inter`. Update `apps/web/vite.config.ts` to register the Tailwind plugin. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/styles/tokens.css` with the full token set from `technical-considerations.md` §2.2 — all CSS custom properties scoped to `:root[data-theme="dark"]` and `:root[data-theme="light"]`. Include a `@theme` block that maps the custom properties to Tailwind theme keys (surface/text/border/accent/danger/success colors, typography scale, radii, shadows, blur) so utilities like `bg-surface-elevated`, `text-text-primary`, `shadow-glow-accent` compile. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/styles/global.css` — CSS reset, body base styles (background from `--surface-base`, text from `--text-primary`, Inter font family), scrollbar polish, box-sizing, `color-scheme` for form-control defaults. Import Inter via `@fontsource-variable/inter` CSS in `main.tsx`. **[Agent: react-frontend]**
  - [x] Task: Import `tokens.css` + `global.css` into `apps/web/src/main.tsx` before React mounts. Add a synchronous inline script to `apps/web/index.html` (before the module script tag) that reads `localStorage.theme` → falls back to `window.matchMedia("(prefers-color-scheme: dark)").matches` → sets `document.documentElement.dataset.theme` accordingly. Default: `dark`. **[Agent: react-frontend]**
  - [x] Verify: Start `apps/web` dev server (background, record PID). Via Playwright DOM: open `http://localhost:5173/` → confirm body computed background is the dark `--surface-base` value AND font is Inter. Then run `localStorage.setItem('theme','light')` via `browser_evaluate` + reload → confirm body background switched to the light surface value. Then clear localStorage and reload → confirm theme matches system preference (dark on default macOS test). Stop web by PID. Delete any screenshots produced. **[Agent: react-frontend]**

---

- [x] **Slice 2: Theme toggle wired — click switches theme, persists across reloads**

  > A visible theme toggle (sun/moon icon) in a minimal top-right position. Click toggles theme, choice persists to localStorage, visible on next reload.

  - [x] Task: Add `lucide-react@^0.400` to `apps/web/package.json` dependencies. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/features/theme/useThemeStore.ts` — Zustand store with `{theme, setTheme, toggleTheme, hydrate}`. `setTheme` updates `document.documentElement.dataset.theme` AND writes `localStorage.theme`. `hydrate` reads localStorage/matchMedia (same logic as the inline script, used as source of truth for the React side after mount). **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/features/theme/ThemeProvider.tsx` — a tiny component wrapping `children`; on mount calls `useThemeStore.getState().hydrate()`. No render output beyond `children`. Wrap `<App />` in it in `main.tsx` (above `BrowserRouter`). **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/ThemeToggle.tsx` — button with `lucide-react` moon icon on light theme and sun icon on dark theme, aria-label "Toggle theme". Reads/calls `useThemeStore`. Minimal fixed positioning (top-right of viewport) for this slice — permanent Header slot comes in Slice 4. **[Agent: react-frontend]**
  - [x] Task: Render `<ThemeToggle />` once in `App.tsx` outside any route (so it shows on every page during this slice). To be removed when Header lands in Slice 4. **[Agent: react-frontend]**
  - [x] Verify: Start web (background, PID). Via Playwright DOM: open `/` with cleared localStorage → confirm initial theme (dark on default). Click the ThemeToggle button → confirm `document.documentElement.dataset.theme` flipped to `light` AND body background changed. Reload → confirm theme persisted. Toggle back → confirm. Stop web by PID. Delete screenshots. **[Agent: react-frontend]**

---

- [x] **Slice 3: Form primitives — Button, Input, PasswordInput, Checkbox, Alert — all 4 auth forms migrated**

  > All forms (Register, Login, ForgotPassword, ResetPassword) render with new primitives. Old `TextField`/`PasswordField`/`FormError` deleted. Error texts and validation flows preserved; existing e2e tests in `apps/api/test/e2e/` still pass.

  - [x] Task: Create `apps/web/src/components/ui/Button.tsx` — supports `variant: "primary"|"secondary"|"ghost"|"danger"`, `size: "sm"|"md"|"lg"`, `isLoading`, `leftIcon`, `rightIcon`, forwardRef. Primary variant uses `--accent-base` fill + glow box-shadow on dark, deeper fill + soft shadow on light. Loading state replaces label with a spinner from lucide-react (`Loader2` with Tailwind `animate-spin`) and locks width. Focus-visible outline uses `--accent-base`. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/Input.tsx` — supports `label`, `error?`, `rightSlot?`, forwardRef, all native `<input>` props. Label on top (aria-connected via `htmlFor`+`id`). Error below with `role="alert"` + alert-circle icon. Invalid border = `--danger-base`. Focus = accent border + glow on dark, thicker accent border on light. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/PasswordInput.tsx` — composes `Input` with a `rightSlot` eye/eye-off icon button that toggles `type` between `password` and `text`. aria-label "Show password"/"Hide password". **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/Checkbox.tsx` — custom-styled checkbox with native `<input type=checkbox>` for a11y, forwardRef, supports `label`, `name`. Checked state uses `--accent-base`. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/Alert.tsx` — supports `tone: "danger"|"success"|"info"`, `title?`, `icon?` (defaults by tone), `children`. Danger has `role="alert"`. Left border strip in tone colour, matching icon from lucide-react. **[Agent: react-frontend]**
  - [x] Task: Migrate `apps/web/src/pages/Register.tsx`, `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` to the new `ui/*` primitives. Replace `TextField`/`PasswordField`/`FormError` imports. Convert the custom inline markup for the 403-unverified block and the lockout block to use `Alert`. Delete `apps/web/src/components/TextField.tsx`, `PasswordField.tsx`, `FormError.tsx`. All error texts and interaction logic (zod validation, setError calls, resend button, lockout message) stay identical. **[Agent: react-frontend]**
  - [x] Verify: Start api + web (background, PIDs). Via Playwright DOM: open `/register`, submit empty → confirm the three field errors ("Enter a valid email", "Nickname can contain 3–20 Latin letters, digits, and underscores", "Password must be at least 8 characters and contain at least one letter and one digit") still render inside the new Input error slots with the coral border. Submit valid data → confirm navigate to `/verify-email/check`. Open `/login`, submit wrong credentials for a registered+verified user → confirm "Invalid email or password" appears inside the Input error slot. Toggle theme during the flow → confirm colours flip. Also run `pnpm --filter api test:e2e` → all 33 tests still pass (they are API-level, so this is a smoke check that the frontend changes didn't break the shared schema import or any other cross-package wiring). Stop daemons by PID. Delete screenshots and dev-outbox contents. **[Agent: react-frontend]**

---

- [x] **Slice 4: Layout chrome — Card, AuthLayout, Header, AppShell — applied to all 8 pages**

  > The app now has a persistent sticky header, forms sit inside glass cards, auth pages share the AuthLayout wrapper. Guest vs authenticated states in the header are distinct.

  - [x] Task: Create `apps/web/src/components/ui/Card.tsx` — supports `variant: "default"|"glass"`, `padding?`. Glass variant: on dark theme uses semi-transparent background + `backdrop-blur-md` + gradient border via two layered pseudo-element techniques (reference Tailwind v4 `mask-composite` or a wrapper trick — pick cleanest). On light theme: white bg + soft shadow + thin border. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/IconButton.tsx` — square button for header icons, variant ghost, size sm/md. aria-label required. **[Agent: react-frontend]**
  - [x] Task: Add `@radix-ui/react-dropdown-menu@^2` to `apps/web/package.json`. Create `apps/web/src/components/ui/DropdownMenu.tsx` — thin wrapper around Radix primitives (Trigger, Content, Item, Separator) with Tailwind-styled slots. Supports accent-colored hover state, menu panel uses Card glass variant on dark. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/Header.tsx` — reads `useAuthStore` to switch guest vs authenticated layout. Guest: logo on left (text "YanChess" clickable → `/`), on right ThemeToggle + text link "Sign in" + Button "Sign up" (primary). Authenticated: logo on left, on right ThemeToggle + Avatar+nickname DropdownMenu with items "Profile" (link to `/profile`) and "Sign out" (calls `logout` + navigate `/`). Sticky positioning. On scroll (listener on `window.scrollY > 8`) adds backdrop-blur background. **[Agent: react-frontend]**
  - [x] Task: Create `apps/web/src/components/ui/AppShell.tsx` — renders `<Header />` + `<main>{children}</main>` with correct spacing. Create `apps/web/src/components/ui/AuthLayout.tsx` — centered glass Card with optional `title` prop (renders h1) and `footer` slot (for "Already have an account? Sign in"-style links). Max-width 440px. **[Agent: react-frontend]**
  - [x] Task: Wrap `<App />` content in `<AppShell>` (in `routes.tsx` or `App.tsx` — whichever is cleanest). Remove the standalone `<ThemeToggle />` added in Slice 2 (now lives inside Header). Wrap the four form pages (`Register`, `Login`, `ForgotPassword`, `ResetPassword`) in `<AuthLayout>` with their respective titles ("Sign up", "Sign in", "Forgot password?", "New password") and footer links where appropriate. **[Agent: react-frontend]**
  - [x] Verify: Start api + web (background, PIDs). Register + verify + login a fresh user via Playwright DOM. Confirm: (a) header shows guest state on `/login` (ThemeToggle + Sign in + Sign up), (b) after login header shows authenticated state (ThemeToggle + nickname with avatar), (c) clicking nickname opens dropdown with "Profile" and "Sign out", (d) "Sign out" logs out and returns to guest header, (e) scrolling a long page produces the blurred sticky header. Toggle theme on each state → both themes render without broken styles. Stop daemons by PID. Delete screenshots + dev-outbox. **[Agent: react-frontend]**

---

- [x] **Slice 5: Profile and auxiliary pages polished — Avatar component, rating card, VerifyEmail states, Home hero**

  > Profile, VerifyEmail/VerifyEmailCheck, Home are now fully styled. All 8 pages feel like one product.

  - [x] Task: Move `apps/web/src/components/AvatarPlaceholder.tsx` → `apps/web/src/components/ui/Avatar.tsx`, keeping the same hash-to-hsl logic. Add `size?: "sm"|"md"|"lg"|"xl"` prop (defaults md=48). Update all imports (`Profile.tsx`, `Header.tsx`). **[Agent: react-frontend]**
  - [x] Task: Restyle `apps/web/src/components/RatingTable.tsx` — wrap in a Card, 4 rows with thin dividers, each row shows mode label (English: "Bullet", "Blitz", "Rapid", "Classical" — add this mapping), large rating number, muted small "N games" below. Rating highlighted with accent color when > 1500 (for future dynamic value; MVP stays 1500 so no highlight). **[Agent: react-frontend]**
  - [x] Task: Restyle `apps/web/src/pages/Profile.tsx` — ProfileLayout: large Avatar (size xl), nickname as h1, registration date muted, RatingTable below, secondary "Sign out" Button at the bottom (not primary — the primary action is header dropdown; keep this one for prominent desktop visibility). **[Agent: react-frontend]**
  - [x] Task: Restyle `apps/web/src/pages/VerifyEmailCheck.tsx` — Card with centered Mail icon (lucide-react, large), h1 "Check your email", paragraph with the email in `<strong>`, muted line "Link is valid for 24 hours", secondary Button "Resend" (disabled — real resend lives on Login per Slice 6 of 001). **[Agent: react-frontend]**
  - [x] Task: Restyle `apps/web/src/pages/VerifyEmail.tsx` three states: loading (Loader2 spinner + "Verifying email…"), success (CheckCircle2 icon in accent + h1 "Email verified" + primary Button Link to `/login`), failure (AlertCircle icon in danger + h1 "Link is invalid" + secondary Button Link to `/forgot-password` + helper paragraph). **[Agent: react-frontend]**
  - [x] Task: Restyle `apps/web/src/pages/Home.tsx` — guest state: hero section with large h1 "YanChess", muted subtitle "Chess online in one click", two large side-by-side Buttons ("Sign in" primary, "Sign up" secondary). Authenticated state: Card with h1 "Hi, `nickname`!", large primary Button "Find game" (goes to `/profile` for now — matchmaking is out of scope). **[Agent: react-frontend]**
  - [x] Verify: Start api + web (background, PIDs). Via Playwright DOM: open `/` as guest → hero visible with two buttons. Register + verify + login → open `/` → authenticated hero visible with "Find game". Open `/profile` → confirm Avatar size xl, English rating labels "Bullet/Blitz/Rapid/Classical", "1500" numbers, "0 games" subtext. Open `/verify-email/check` → confirm Mail icon + email in bold. Open `/verify-email?token=garbage` → confirm failure state with AlertCircle. Open `/verify-email?token=<valid>` for a fresh unverified user → confirm success state with CheckCircle. Toggle theme on each → all polished. Stop daemons by PID. Delete screenshots + dev-outbox. **[Agent: react-frontend]**

---

- [x] **Slice 6: Mobile responsiveness, a11y hardening, chessboard pattern overlay, FOUC-free polish**

  > Pages render correctly on 375px-wide screens. Keyboard focus visible everywhere. Dark theme shows the subtle chessboard pattern.

  - [x] Task: Add responsive breakpoints to Header — below 640px replace the right-side text links with a `Menu` icon that opens a `DropdownMenu` with the same items. Keep ThemeToggle visible. **[Agent: react-frontend]**
  - [x] Task: Apply responsive paddings and max-widths to AuthLayout, Profile Card, Home hero — on <640px: full-width cards with 16px side padding; on ≥640px: centered with max-width. Buttons on hero stack vertically on <640px. **[Agent: react-frontend]**
  - [x] Task: Add `apps/web/public/chessboard-pattern.svg` — an 8×8 pattern of 2×2 squares in a muted neutral. Apply via a `::before` pseudo-element on body in `global.css` with `background-image: url(/chessboard-pattern.svg)`, `background-size: 240px`, `opacity: 0.03`, `pointer-events: none`, `z-index: -1`. Scope the rule to `[data-theme="dark"]` so light theme stays clean. **[Agent: react-frontend]**
  - [x] Task: A11y audit sweep — ensure all interactive elements (Button, IconButton, Input, Checkbox, DropdownMenu Trigger/Item, Alert, Link in Header) show a visible focus ring using the accent color via `focus-visible:` Tailwind variant. Add `aria-label` to any icon-only buttons. Audit the eye-icon in PasswordInput: label switches between "Show password" and "Hide password". Confirm Alert role="alert" fires on all danger-tone instances. **[Agent: react-frontend]**
  - [x] Verify: Start api + web (background, PIDs). Via Playwright DOM at viewport 375×812: open `/login` → confirm form fits with padding, button is full-width-ish. Click Menu icon in header → confirm dropdown opens. Resize to 1440px → confirm Header reverts to text links. Open `/` on dark theme → confirm the chessboard pattern is visible but subtle (take a screenshot and verify the body `::before` has correct background-image set via `getComputedStyle`). Toggle to light → pattern should disappear. Keyboard test: focus into `/register`, press Tab repeatedly → confirm each form field + submit button + header items get a visible accent focus ring (via `document.activeElement` + `getComputedStyle(active).outlineColor`). Stop daemons by PID. Delete screenshots. **[Agent: react-frontend]**

---

- [x] **Slice 7: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 002-visual-design-foundation` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
