<!--
This document describes HOW to build the feature at an architectural level.
It is NOT a copy-paste implementation guide.

DO:
- Describe data models (table names, key columns, relationships)
- Describe API contracts (endpoints, request/response shapes)
- Reference file paths where code will live
- Note critical configuration requirements

DON'T:
- Include full code implementations
- Write complete schema definitions
- Provide copy-paste config files
-->

# Technical Specification: Visual Design Foundation (002)

- **Functional Specification:** `context/spec/002-visual-design-foundation/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

**Assumption — Styling approach: Tailwind CSS v4 with CSS variables.** Tailwind v4 adopts a CSS-variable-first theming model where all configuration lives in a `@theme` block in a CSS file rather than a JavaScript config, which removes a build-time indirection and makes tokens directly readable in DevTools. Its utility classes compose cleanly with glass/blur/shadow effects (e.g., `backdrop-blur-md`, `shadow-glow`) that the design requires, and the static output has no runtime overhead. This is the recommended choice; to override, replace Tailwind with vanilla CSS Modules + the same CSS variable tokens — the token layer transfers without change.

**Theme state** is managed by a tiny Zustand store (`useThemeStore`) that sets `document.documentElement.dataset.theme` as a side effect. All CSS tokens are scoped to `[data-theme="dark"]` and `[data-theme="light"]` on `:root`. A synchronous inline script in `index.html` reads `localStorage.theme` (or falls back to `matchMedia`) and writes `data-theme` before React mounts, eliminating flash of wrong theme (FOUC).

**Component library**: built in-house under `src/components/ui/`. The scope covers ten primitives (Button, Input, PasswordInput, Checkbox, Card, Alert, IconButton, DropdownMenu, ThemeToggle, AuthLayout, Header, AppShell). The sole external headless dependency for UI behavior is `@radix-ui/react-dropdown-menu`, used only for the profile dropdown (keyboard navigation, focus trap, ARIA roles). Icons come from `lucide-react` (tree-shakeable SVG). Typography uses the Inter variable font via `@fontsource-variable/inter` (bundled) or a `<link>` preload in `index.html`.

**Systems affected**: `apps/web` only. No backend impact. No changes to API contracts or auth flows.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Architecture Changes

- No new services. No backend changes.
- New directory `apps/web/src/styles/` containing three CSS files:
  - `tokens.css` — all CSS custom properties for both themes.
  - `global.css` — base reset, body background, scrollbar styling, `font-face` or `@import` for Inter.
  - `effects.css` — optional helpers for glass/glow patterns not directly covered by Tailwind utilities (e.g., reusable gradient border mixin).
- New directory `apps/web/src/components/ui/` for all primitive components.
- New feature slice `apps/web/src/features/theme/` containing `useThemeStore.ts` and `ThemeProvider.tsx`.
- `apps/web/index.html` gains: Inter font `<link rel="preload">` and an inline `<script>` for FOUC prevention.
- `apps/web/public/chessboard-pattern.svg` — new static asset.
- New dev dependency in `apps/web/package.json`: `tailwindcss@^4`, `@tailwindcss/vite`, `@radix-ui/react-dropdown-menu`, `lucide-react`, `@fontsource-variable/inter`.
- `apps/web/vite.config.ts` gains the `@tailwindcss/vite` plugin.

### 2.2 Design Tokens

All tokens are CSS custom properties defined in `src/styles/tokens.css` under `[data-theme="dark"]` and `[data-theme="light"]` selectors on `:root`. They are mapped into Tailwind's `@theme` block so utility classes resolve them.

#### Surface colors

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--surface-base` | `#0d0f14` | `#f5f4f0` | Page / body background |
| `--surface-elevated` | `rgba(255,255,255,0.06)` | `#ffffff` | Card background |
| `--surface-overlay` | `rgba(255,255,255,0.10)` | `#ffffff` | Dropdown / modal background |
| `--surface-glass` | `rgba(255,255,255,0.07)` | `#ffffff` | Glass card background with alpha |

#### Text colors

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--text-primary` | `#e8eaf0` | `#1a1d23` | Body text |
| `--text-secondary` | `#9ca3af` | `#4b5563` | Subtext, field labels |
| `--text-muted` | `#6b7280` | `#9ca3af` | Hints, placeholders |
| `--text-inverse` | `#ffffff` | `#ffffff` | Text on filled accent button |

#### Border / divider

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--border-subtle` | `rgba(255,255,255,0.08)` | `#e5e7eb` | Default input / card outline |
| `--border-strong` | `rgba(255,255,255,0.18)` | `#9ca3af` | Dividers, strong separation |
| `--border-focus` | `#10B981` | `#059669` | Focus ring on inputs |

#### Accent (emerald)

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--accent-base` | `#10B981` | `#059669` | Primary button fill, links, active states |
| `--accent-hover` | `#34d399` | `#047857` | Hover state of accent elements |
| `--accent-glow` | `rgba(16,185,129,0.35)` | `transparent` | Box-shadow color for glow on focus/hover (dark only) |

#### Status

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--danger-base` | `#f87171` | `#dc2626` | Error text, error border |
| `--danger-surface` | `rgba(248,113,113,0.12)` | `#fef2f2` | Error Alert background |
| `--success-base` | same as `--accent-base` | same as `--accent-base` | Success text, success border |
| `--success-surface` | `rgba(16,185,129,0.12)` | `#f0fdf4` | Success Alert background |

#### Typography scale

| Token | Value | Purpose |
|---|---|---|
| `--font-sans` | `'Inter Variable', system-ui, sans-serif` | Body / UI font stack |
| `--text-xs` | `0.75rem` | Fine print |
| `--text-sm` | `0.875rem` | Field labels, secondary text |
| `--text-base` | `1rem` | Body, inputs |
| `--text-lg` | `1.125rem` | Sub-headings |
| `--text-xl` | `1.25rem` | Card titles |
| `--text-2xl` | `1.5rem` | Page sub-headings |
| `--text-3xl` | `2rem` | Page h1 (form pages) |
| `--leading-tight` | `1.25` | Headings |
| `--leading-normal` | `1.5` | Body |
| `--leading-relaxed` | `1.625` | Longer prose blocks |

#### Radii

| Token | Value | Purpose |
|---|---|---|
| `--radius-sm` | `4px` | Small badges, tags |
| `--radius-md` | `8px` | Inputs, icon buttons |
| `--radius-lg` | `12px` | Cards |
| `--radius-xl` | `16px` | Large cards, AuthLayout card |

#### Shadows

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.4)` | `0 1px 3px rgba(0,0,0,0.1)` | Subtle depth |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.5)` | `0 4px 12px rgba(0,0,0,0.08)` | Card shadow |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.6)` | `0 8px 32px rgba(0,0,0,0.12)` | Elevated panels |
| `--shadow-glow-accent` | `0 0 20px rgba(16,185,129,0.4)` | `none` | Accent glow on primary button / focus |

#### Blur

| Token | Value | Purpose |
|---|---|---|
| `--blur-glass` | `16px` | `backdrop-filter: blur(var(--blur-glass))` on glass cards |

Spacing uses Tailwind's default 4px scale; no custom spacing tokens needed.

### 2.3 Tailwind v4 Configuration

Tailwind v4 is configured entirely in CSS. The entry CSS file (`src/styles/global.css`) starts with `@import "tailwindcss"` and includes an `@theme` block that maps the custom properties defined in `tokens.css` to Tailwind theme keys. This allows utility classes such as `bg-surface-elevated`, `text-text-primary`, `shadow-glow-accent`, `rounded-lg` (mapped to `--radius-lg`) to work out of the box.

The `@tailwindcss/vite` Vite plugin is registered in `apps/web/vite.config.ts`. No `tailwind.config.ts` file is created. Refer to the official [Tailwind CSS v4 `@theme` directive documentation](https://tailwindcss.com/docs/v4-upgrade) for the exact `@theme` and `@variant` syntax — this spec does not reproduce it.

Dark/light variant is handled via `@variant dark ('[data-theme="dark"] &')` so that `dark:` prefix utilities read the `data-theme` attribute rather than the OS media query.

### 2.4 Component Breakdown

All new UI primitives live in `apps/web/src/components/ui/`. TypeScript interfaces for props are co-located in each file. All components are strict-typed — no `any`, no implicit prop spreading without explicit rest types.

#### Primitive components

| Component | File | Key props | States / behavior |
|---|---|---|---|
| `Button` | `ui/Button.tsx` | `variant: "primary" \| "secondary" \| "ghost" \| "danger"`, `size: "sm" \| "md" \| "lg"`, `isLoading: boolean`, `leftIcon?: ReactNode`, `rightIcon?: ReactNode`, rest `ButtonHTMLAttributes` | hover, active, focus-visible, disabled, loading (replaces label with spinner, locks width via fixed `min-width`). Primary: filled accent + `--shadow-glow-accent` on dark. Secondary: outline. Ghost: text only. |
| `Input` | `ui/Input.tsx` | `label: string`, `error?: string`, `name: string`, `type?: string`, `rightSlot?: ReactNode`, rest `InputHTMLAttributes` | default, hover, focus (accent border + glow), invalid (danger border), disabled. Label above, error below with `role="alert"`. Replaces `TextField.tsx`. |
| `PasswordInput` | `ui/PasswordInput.tsx` | inherits `Input` props minus `type` and `rightSlot` | Wraps `Input` with a managed visibility toggle; passes eye/eye-off `IconButton` as `rightSlot`. Replaces `PasswordField.tsx`. |
| `Checkbox` | `ui/Checkbox.tsx` | `label: string`, `name: string`, rest `InputHTMLAttributes<HTMLInputElement>` | default, focus-visible, checked. Custom styled, retains native `<input type="checkbox">` semantics. Used for "Remember me" (future). |
| `Card` | `ui/Card.tsx` | `variant: "default" \| "glass"`, `padding?: "sm" \| "md" \| "lg"`, `children: ReactNode` | Stateless. Glass on dark: `backdrop-blur`, gradient border via pseudo-element, `--shadow-md`. Default on light: white bg, `--shadow-md`, subtle border. |
| `Alert` | `ui/Alert.tsx` | `tone: "danger" \| "success" \| "info"`, `title?: string`, `children: ReactNode`, `icon?: ReactNode` | Stateless. `role="alert"` for danger tone. Colored left-border or background per tone. Replaces `FormError.tsx`. |
| `IconButton` | `ui/IconButton.tsx` | `label: string` (aria-label), `icon: ReactNode`, rest `ButtonHTMLAttributes` | hover, focus-visible. Used for ThemeToggle, password eye-toggle, mobile menu. |
| `DropdownMenu` | `ui/DropdownMenu.tsx` | Wraps `@radix-ui/react-dropdown-menu` primitives. Exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` | Radix handles keyboard navigation, focus trap, ARIA roles. Styled via CSS classes consuming tokens. |
| `ThemeToggle` | `ui/ThemeToggle.tsx` | No props | Renders `IconButton` with aria-label `"Toggle theme"`. Reads `useThemeStore` for current theme; shows `Moon` icon when light, `Sun` icon when dark. Calls `toggleTheme()` on click. |
| `AuthLayout` | `ui/AuthLayout.tsx` | `children: ReactNode`, `title?: string`, `footer?: ReactNode` | Full-viewport centering. Renders `Header` at top, glass `Card` with form content in center, optional footer text below card. Background applies chessboard texture overlay (dark theme only) via `::before` pseudo-element. |
| `Header` | `ui/Header.tsx` | No props | Reads `useAuthStore` (user) and `useThemeStore`. Guest state: logo + "Sign in" + "Sign up" links + `ThemeToggle`. Authenticated state: logo + `Avatar` + username + `DropdownMenu` (Profile / Sign out) + `ThemeToggle`. Sticky via `position: sticky; top: 0`. On scroll gains `backdrop-blur` + semi-transparent bg via a JS scroll listener toggling a CSS class. Mobile (<640 px): links collapse into hamburger `IconButton` opening the same `DropdownMenu`. |
| `AppShell` | `ui/AppShell.tsx` | `children: ReactNode` | Composes `Header` + `<main>` wrapper. Used by every page. |
| `Avatar` | `ui/Avatar.tsx` | `username: string`, `size?: "sm" \| "md" \| "lg"` | Deterministic hue-from-username hash (existing `AvatarPlaceholder` logic). Moved to `ui/Avatar.tsx` for consistency. |

#### Deprecated / replaced components

| Old file | Replaced by | Migration |
|---|---|---|
| `src/components/TextField.tsx` | `ui/Input.tsx` | Update all imports. Old file deleted. |
| `src/components/PasswordField.tsx` | `ui/PasswordInput.tsx` | Update all imports. Old file deleted. |
| `src/components/FormError.tsx` | `ui/Alert.tsx` | Update all imports. Old file deleted. |
| `src/components/AvatarPlaceholder.tsx` | `ui/Avatar.tsx` | Update all imports. Old file deleted. |
| `src/components/RatingTable.tsx` | Stays, gains `Card` as container | Minor update. |

Migration is done in a single atomic task so no page is ever left with broken imports.

### 2.5 Page Updates

All eight pages are wrapped in `AppShell` (via `App.tsx`). Pages that currently have inline styles lose them in favor of Tailwind utilities and the new component primitives.

| Page | Changes |
|---|---|
| `Home.tsx` | Guest: `Card` (glass) containing h1 "YanChess", slogan, `Button` primary "Sign in" + `Button` secondary "Sign up". Authenticated: `Card` "Hi, {username}" + `Button` primary "Find game" (stub link). |
| `Register.tsx` | Wrap in `AuthLayout`. Replace `TextField` → `Input`, `PasswordField` → `PasswordInput`, `FormError` → `Alert`. Submit button → `Button` primary with `isLoading`. Footer link "Already have an account? Sign in". |
| `Login.tsx` | Same as Register. Add "Remember me" `Checkbox` and "Forgot password?" text link. |
| `ForgotPassword.tsx` | Wrap in `AuthLayout`. Replace fields + error components. |
| `ResetPassword.tsx` | Wrap in `AuthLayout`. Replace fields + error components. |
| `VerifyEmailCheck.tsx` | `AuthLayout` + `Card` with Mail icon (`lucide-react`), static text, email display. |
| `VerifyEmail.tsx` | `AuthLayout` + `Card` showing three states: loading (spinner), success (`CheckCircle` icon + `Button` "Sign in"), error (`AlertCircle` icon + `Button` + link). |
| `Profile.tsx` | Remove inline styles. `Card` wrapper with `Avatar` (lg), username, registration date. Rating section with dividers. `Button` secondary "Sign out". |

### 2.6 Theme Management

File: `apps/web/src/features/theme/useThemeStore.ts`.

Store shape (Zustand):

```
{
  theme: "dark" | "light"
  setTheme(t: "dark" | "light"): void   // writes data-theme attribute + localStorage
  toggleTheme(): void
  hydrate(): void                        // reads localStorage → matchMedia → sets theme
}
```

Side effects of `setTheme`: writes `document.documentElement.dataset.theme` and `localStorage.setItem("theme", t)`.

`ThemeProvider` (`src/features/theme/ThemeProvider.tsx`): a React component that calls `useEffect(() => hydrate(), [])` on mount. Placed at the root in `App.tsx`.

FOUC prevention: a synchronous inline `<script>` tag in `apps/web/index.html`, placed before the main React bundle `<script>`, reads `localStorage.theme` (or `window.matchMedia("(prefers-color-scheme: dark)").matches`) and immediately sets `document.documentElement.dataset.theme`. This runs before first paint. The inline script must be minimal (no external dependencies).

`prefers-color-scheme` media query change listener: deferred to a future iteration.

### 2.7 Chessboard Texture Overlay

Asset: `apps/web/public/chessboard-pattern.svg`. An SVG `<pattern>` element defining a repeating 2×2 square tile (alternating transparent and solid squares, black/white). Served statically.

Applied in CSS on `body::before` (or `AuthLayout`'s root `::before`) on dark theme only:
- `background-image: url('/chessboard-pattern.svg')`
- `background-size: 240px`
- `opacity` ~0.03 (3%)
- `pointer-events: none`, `position: absolute`, `inset: 0`, `z-index: -1`

Light theme: no pattern applied.

### 2.8 Accessibility Requirements

- Use `:focus-visible` pseudo-class for all focus ring styles; never `:focus` alone. This avoids the ring appearing on mouse click.
- Focus ring color: `--border-focus` (accent emerald) with sufficient width (≥2px outline).
- All `<input>` elements paired with `<label htmlFor={id}>` — existing behavior is preserved.
- `Alert` with `tone="danger"` renders `role="alert"` so screen readers announce errors immediately.
- `ThemeToggle` has an explicit `aria-label` ("Toggle theme").
- `DropdownMenu` (Radix) provides ARIA menu roles, keyboard arrow navigation, and Escape to close without additional work.
- Touch target minimum: 44×44 px effective tap area on all interactive elements (buttons, icon buttons). Achieved via padding on `IconButton` and `Button` (size md/lg).
- Color contrast: token values in §2.2 must be verified at implementation time. Target: `--text-primary` on `--surface-base` ≥ 4.5:1 (AA normal text), `--text-inverse` on `--accent-base` ≥ 3:1 (AA large text / UI components). The exact ratios are validated with a contrast checker tool during the verify task; if any token fails, the dark value is adjusted toward lighter or the light value toward darker until the ratio is met.

### 2.9 File Layout

```
apps/web/
  index.html                              # add FOUC inline script, Inter font <link>
  vite.config.ts                          # add @tailwindcss/vite plugin
  package.json                            # add tailwindcss, @tailwindcss/vite,
                                          # @radix-ui/react-dropdown-menu,
                                          # lucide-react, @fontsource-variable/inter
  public/
    chessboard-pattern.svg                # new
  src/
    styles/
      tokens.css                          # new — CSS custom properties both themes
      global.css                          # new — reset, body bg, @import tailwindcss
      effects.css                         # new — optional glass/gradient helpers
    components/
      ui/
        Alert.tsx                         # new (replaces FormError)
        AppShell.tsx                      # new
        AuthLayout.tsx                    # new
        Avatar.tsx                        # moved (replaces AvatarPlaceholder)
        Button.tsx                        # new
        Card.tsx                          # new
        Checkbox.tsx                      # new
        DropdownMenu.tsx                  # new (Radix wrapper)
        Header.tsx                        # new
        IconButton.tsx                    # new
        Input.tsx                         # new (replaces TextField)
        PasswordInput.tsx                 # new (replaces PasswordField)
        ThemeToggle.tsx                   # new
      RatingTable.tsx                     # updated — uses Card as container
      # TextField.tsx — deleted
      # PasswordField.tsx — deleted
      # FormError.tsx — deleted
      # AvatarPlaceholder.tsx — deleted
    features/
      auth/                               # unchanged
      theme/
        useThemeStore.ts                  # new
        ThemeProvider.tsx                 # new
    pages/
      Home.tsx                            # updated
      Register.tsx                        # updated
      Login.tsx                           # updated
      ForgotPassword.tsx                  # updated
      ResetPassword.tsx                   # updated
      VerifyEmailCheck.tsx                # updated
      VerifyEmail.tsx                     # updated
      Profile.tsx                         # updated (remove inline styles)
    App.tsx                               # wraps in ThemeProvider + AppShell
    main.tsx                              # unchanged
```

---

## 3. Impact and Risk Analysis

**System Dependencies**

- Zero backend impact. All changes are contained within `apps/web`.
- New runtime dependencies: `@radix-ui/react-dropdown-menu`, `lucide-react`, `@fontsource-variable/inter`.
- New dev/build dependencies: `tailwindcss@^4`, `@tailwindcss/vite`.
- `@yanchess/shared` package is not modified (Zod schemas and error strings stay as-is).
- `useAuthStore` in `features/auth/useAuthStore.ts` is read (not modified) by `Header`.

**Potential Risks and Mitigations**

| Risk | Likelihood | Mitigation |
|---|---|---|
| FOUC (flash of wrong theme) on first paint | High without mitigation | Synchronous inline script in `index.html` sets `data-theme` before React bundle executes. Must be the very first script in `<head>`. |
| `backdrop-filter` not working in Safari < 15 | Low (target modern browsers) | Tailwind v4 generates `-webkit-backdrop-filter` alongside standard property. Add a graceful degradation fallback (solid semi-transparent bg) via `@supports not (backdrop-filter: blur(1px))`. |
| Breaking imports when old components are deleted | Certain — all 8 pages import from old paths | Migrate all pages in one atomic task. TypeScript compilation check (`tsc --noEmit`) used as the gate before the task is marked done. |
| Chessboard pattern appearing visually noisy | Medium | Opacity fixed at ~3%. Encapsulated via a CSS token (`--pattern-opacity: 0.03`) so it can be set to `0` if testing reveals distraction. |
| Inter font causing layout shift (FOUT) | Low | Use `@fontsource-variable/inter` (bundled, served locally). Set `font-display: swap`. Add `<link rel="preload">` in `index.html` for the variable font wax subset. |
| Contrast failure on glass panes (text on blurred bg) | Medium | Pattern opacity is kept very low. Token values in §2.2 target WCAG AA. Implementation-time contrast check with a tool (e.g., `axe-core` or manual DevTools color picker) is part of the verify task. |
| Tailwind v4 API differences from v3 | Medium (v4 is a major version) | Refer to Tailwind v4 migration guide. Key difference: `@theme` in CSS replaces `tailwind.config.ts`. No PostCSS plugin; use the Vite plugin exclusively. |
| `useThemeStore` hydration on SSR (if added later) | Low (no SSR in scope) | Hydration is guarded by `typeof window !== "undefined"` in `hydrate()`. No action needed for MVP. |

---

## 4. Testing Strategy

**Visual regression**: not in scope for MVP. The project uses Playwright-via-MCP for ad-hoc verification. After each implementation task, screenshots are captured to `docs/screenshots/` using the `/awos:verify` convention (one screenshot per page per theme — 16 total for 8 pages × 2 themes). The user reviews these screenshots to confirm visual acceptance criteria.

**Unit tests**: no unit tests for pure visual/layout components. `useThemeStore` may be covered by a single Vitest test if the implementation is trivial — not a hard requirement. The store's logic is: read localStorage/matchMedia → set `data-theme` attribute — straightforward enough that a compile-time TypeScript check plus manual verification is sufficient for MVP.

**Accessibility checks**: during the `/awos:verify` task, the following checks are performed via Playwright DOM inspection (not screenshots):
- `document.activeElement` advances through form fields and buttons in correct Tab order.
- Focused elements have a visible non-system focus ring (check that `outline` or `box-shadow` is non-zero and accent-colored).
- `Alert` elements with `role="alert"` are present in the DOM when validation errors are triggered.

**Contrast validation**: at implementation time, verify the token pairs listed in §2.2 using a WCAG contrast tool. Document pass/fail ratios in the verify task output. Any failing pair triggers a token value adjustment before the task is closed.

**Build gate**: `tsc --noEmit` must pass with zero errors after all import migrations. This is the primary correctness gate for the component refactor.
