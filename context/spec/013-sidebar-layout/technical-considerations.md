# Technical Specification: Sidebar Layout

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Draft
- **Author(s):** AWOS /awos:tech (orchestrator + react-frontend specialist)

---

## 1. High-Level Technical Approach

Replace `<Header />` inside `AppShell.tsx` with a route-aware wrapper that renders `<Sidebar />` + `<main>` for all non-auth routes and a bare `<main>` for the five auth-flow pages. `Sidebar.tsx` composes three sub-components — `SidebarLogo`, `SidebarMenu`, and a bottom section that switches between `SidebarAnonymousBottom` / `SidebarSignedInBottom` based on `useAuthStore(s => s.user)`. The `LanguageSwitcher` trigger is a one-line change: `{current.toUpperCase()}` → `{t(\`languages.${current}\`)}` using keys that already resolve to full endonyms in the existing `common.json` files. On `<768px` the sidebar collapses into a Radix Dialog slide-in drawer triggered by a hamburger button fixed to the top-left of the viewport.

Scope touches only `apps/web/src/components/ui/*`, `apps/web/src/features/i18n/LanguageSwitcher.tsx`, and `apps/web/src/i18n/locales/*/common.json`. No backend changes, no routing structure changes, no shared package changes.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 File map

| Path | Status | Purpose |
|---|---|---|
| `apps/web/src/components/ui/Sidebar.tsx` | new | Root sidebar component; composes Logo + Menu + bottom section |
| `apps/web/src/components/ui/sidebar/SidebarLogo.tsx` | new | "YanChess" text link → `/` with `aria-label` |
| `apps/web/src/components/ui/sidebar/SidebarMenu.tsx` | new | Vertical nav list; active-route highlight via `useLocation` |
| `apps/web/src/components/ui/sidebar/SidebarAnonymousBottom.tsx` | new | Login button, Register button, ThemeToggle, LanguageSwitcher |
| `apps/web/src/components/ui/sidebar/SidebarSignedInBottom.tsx` | new | Avatar+nickname row, 5 action icons (Settings/Friends/Chat-disabled/Notifications/Logout), ThemeToggle, LanguageSwitcher |
| `apps/web/src/components/ui/sidebar/SidebarMobileDrawer.tsx` | new | `<768px` hamburger-triggered Radix Dialog wrapping `<Sidebar />` |
| `apps/web/src/components/ui/AppShell.tsx` | amend | Adds `useLocation()`, auth-route check, renders sidebar+main OR bare main; removes `<Header />` import |
| `apps/web/src/components/ui/Header.tsx` | delete | Removed entirely |
| `apps/web/src/features/i18n/LanguageSwitcher.tsx` | amend | Trigger: `{current.toUpperCase()}` → `` {t(`languages.${current}`)} `` |
| `apps/web/src/i18n/locales/{en,ru,es}/common.json` | amend | New keys: `sidebar.play`, `sidebar.settings`, `sidebar.friends`, `sidebar.chat`, `sidebar.notifications`, `sidebar.logout`, `sidebar.theme`, `sidebar.logoAriaLabel`, `sidebar.openMenu`, `sidebar.closeMenu` — translated across all 3 locales |
| `apps/web/src/styles/tokens.css` | amend | Add CSS variable `--sidebar-width: 240px` for layout math centralization |
| `apps/web/src/components/ui/__tests__/Sidebar.test.tsx` | new | Anonymous bottom, signed-in bottom, logo link, active-route highlight, chat disabled, logout wires |
| `apps/web/src/components/ui/__tests__/AppShell.routes.test.tsx` | new | Sidebar visible on `/play` + `/profile`; absent on all 5 auth routes |
| `apps/web/src/features/i18n/__tests__/LanguageSwitcher.endonym.test.tsx` | new | Trigger shows "English" / "Русский" / "Español" per locale |

### 2.2 Route-aware AppShell

```ts
const AUTH_ROUTES = [
  '/login', '/register',
  '/verify-email', '/forgot-password', '/reset-password',
];
const { pathname } = useLocation();
const hideChrome = AUTH_ROUTES.some(
  r => pathname === r || pathname.startsWith(r + '/')
);
return hideChrome
  ? <main className="min-h-screen">{children}</main>
  : <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>;
```

No React Router nesting changes. `AppShell` stays a plain wrapper component.

### 2.3 Sidebar structure

`Sidebar.tsx` is a `flex flex-col h-screen w-60` fixed-position element. Three vertical regions via flexbox:

- **Top** (`p-4`) — `<SidebarLogo />`.
- **Middle** (`flex-1 overflow-y-auto`) — `<SidebarMenu />` with current single Play item; slot for future items.
- **Bottom** (`mt-auto`) — conditionally renders `<SidebarAnonymousBottom />` or `<SidebarSignedInBottom />` based on `useAuthStore(s => s.user) !== null`.

On `md:` (≥768px) the sidebar is rendered inline in the layout flex. On `<768px` the inline Sidebar is hidden (`hidden md:flex`) and `SidebarMobileDrawer` renders a hamburger `IconButton` fixed at `top-4 left-4` which opens a Radix Dialog containing the full Sidebar in slide-in form.

### 2.4 Active-route highlight

`SidebarMenu` accepts `items: NavItem[]` where each item carries `{ path, labelKey, icon }`. Reads `useLocation().pathname` once per render. For each item derives `isActive = pathname === item.path` and renders:

- `aria-current="page"` on active item.
- Active styling: filled icon variant + `bg-surface-hover`.
- Inactive styling: outline icon + no background.

Adding a future menu item is a one-line change to the `items` array — no logic edits.

### 2.5 Mobile drawer

**Assumption** — on `<768px` the sidebar is a Radix `Dialog` (role `dialog`) slide-in from the left, triggered by a hamburger `IconButton` fixed at `top-4 left-4` with `md:hidden`. Closing on outside-click + `Escape` handled by Radix out of the box. The full sidebar content (logo, menu, bottom section) renders inside the drawer — no icon-only strip variant. Rationale: full labels help new users; icon-only mode would require tooltips to be useful + wouldn't fit the 2-line menu label pattern.

**Alternative considered:** permanently-visible icon-only bar (56px wide). Rejected — spec 2.6 criterion "navigation is reachable without permanently blocking the main content area" favors the drawer.

### 2.6 Signed-in bottom section — action icons

All icons from `lucide-react` (project convention). Rendered as `<IconButton aria-label={t('sidebar.<key>')}>` with Radix `Tooltip` on hover.

| Icon | lucide export | State in spec 013 |
|---|---|---|
| Settings | `Settings` | Enabled, `onClick` no-op (popup in spec 015) |
| Friends | `Users` | Enabled, `onClick` no-op; `pendingRequestsCount` badge from `useFriendsStore` |
| Chat | `MessageSquare` | `opacity-50 cursor-not-allowed pointer-events-none`, no tooltip |
| Notifications | `Bell` | Enabled, `onClick` no-op (popup in spec 015) |
| Logout | `LogOut` | Enabled, calls `authService.logout()` + routes to `/login` |

### 2.7 Sign-out gap resolution — temporary 5th icon

**Assumption:** Add a 5th action icon in the signed-in bottom section: **Logout** (`LogOut` from `lucide-react`). It calls the existing `authService.logout()` function (same path the removed Header dropdown used). Spec 015 will move this entry into the Settings popup; this spec's AC §2.5 is amended by the Change Log to reflect this temporary stopgap.

Rationale: deleting `Header.tsx` removes the only visible sign-out control today. Signed-in users must be able to sign out — a UX regression during the 013→015 window is unacceptable. The 5th icon is explicitly marked as **temporary** in the implementation (code comment `// REMOVED in spec 015 — moved to Settings popup`) so it is easy to find and delete later.

### 2.8 LanguageSwitcher one-line change

`apps/web/src/features/i18n/LanguageSwitcher.tsx` line 24:

```diff
- <Button variant="ghost" size="sm">{current.toUpperCase()}</Button>
+ <Button variant="ghost" size="sm">{t(`languages.${current}`)}</Button>
```

No other changes. The `common.json` keys `languages.en`, `languages.ru`, `languages.es` already contain the full endonyms ("English", "Русский", "Español"). No translation file updates needed for this line.

### 2.9 Logo

`SidebarLogo.tsx` keeps the current Header pattern — text "YanChess" (via `t('header.appName')`) inside a `<Link to="/">` with hover styling. **No SVG upgrade in this spec.** A future spec can swap it for an SVG mark without touching the Sidebar structure. `aria-label` from `t('sidebar.logoAriaLabel')` for screen readers.

### 2.10 CSS token

Add to `apps/web/src/styles/tokens.css`:

```css
:root {
  --sidebar-width: 240px;
}
```

Use via `w-[var(--sidebar-width)]` in Tailwind. Future redesigns resize the sidebar by changing this one value.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **No backend changes.** This is a pure frontend layout refactor.
- **No shared package changes.** Shared types unaffected.
- **No new npm dependencies.** All UI primitives (`lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`) are already in `apps/web/package.json`.
- **No translation infrastructure changes.** New keys slot into existing `common.json`.
- **No test-infra changes.** Vitest + RTL + MemoryRouter already set up (278+ tests passing).

### 3.2 Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing tests select Header by text/role (`getByRole('banner')`, `getByText('YanChess')`, etc.) | Before deleting `Header.tsx`, grep `apps/web/src/**/__tests__/**` for Header-dependent selectors + update to use Sidebar selectors or scope narrower (e.g., target the page component directly) |
| Sign-out regression during 013→015 window | Resolved via §2.7 — temporary 5th action icon (Logout). Will be absorbed into Settings popup in spec 015 |
| Mobile viewport layout bugs (375px) | Verify slice drives Playwright with `browser_resize` to 375×812; hamburger must be reachable + drawer slide-in must work |
| `/vs-bot` route sits inside `AuthenticatedLayout` (BACKLOG drift from spec 005) | Not fixed here. Sidebar follows the same layout boundaries. Anonymous visitor clicking "Play" lands on `/play` where ProtectedRoute will redirect to `/login` — same behavior as today |
| CSS tokens.css has no sidebar-width variable | Added as `--sidebar-width: 240px` in §2.10 — small change, centralizes future resizing |
| Narrow sidebar labels could clip in Russian (longer average word length) | Tailwind `truncate` on menu labels + sidebar width 240px gives ~200px for text — enough for "Настройки" (10 chars) and "Уведомления" (11 chars). Test in Russian locale during Verify |

---

## 4. Testing Strategy

### 4.1 Component tests (Vitest + React Testing Library)

- **`Sidebar.test.tsx`:**
  - Anonymous: Login + Register buttons present; action icons NOT present.
  - Signed-in (mock `useAuthStore` with `user: mockUser`): avatar + nickname + 5 action icons + ThemeToggle + LanguageSwitcher.
  - Active-route highlight: `MemoryRouter initialEntries={['/play']}` → Play item has `aria-current="page"`.
  - Chat icon has `cursor-not-allowed` class + `onClick` no-op.
  - Logout icon: clicking it calls mocked `authService.logout()`.
- **`AppShell.routes.test.tsx`:**
  - `initialEntries={['/login']}` → `queryByRole('navigation')` returns `null`.
  - `initialEntries={['/register']}` → same.
  - Each of `/verify-email`, `/forgot-password`, `/reset-password` → same.
  - `initialEntries={['/play']}` → Sidebar present (`getByRole('navigation')`).
- **`LanguageSwitcher.endonym.test.tsx`:**
  - `testI18n.changeLanguage('en')` → trigger text equals `'English'`.
  - `testI18n.changeLanguage('ru')` → `'Русский'`.
  - `testI18n.changeLanguage('es')` → `'Español'`.
  - RED validation: temporarily revert the one-line change back to `.toUpperCase()` → test fails with the uppercased value.

Expected test-count delta: **321 → ~335** web tests.

### 4.2 Live smoke (Verify slice, Playwright MCP)

- Desktop (1280×720): sidebar visible on `/`, `/play`, `/profile`; absent on `/login`, `/register`.
- Mobile (375×812): hamburger IconButton visible top-left; tap → sidebar slide-in; tap outside → close.
- Language switch via sidebar: switch to RU → confirm all sidebar labels render in Russian + trigger shows "Русский".
- Theme switch via sidebar: switch dark→light + reload → theme persists.
- Signed-in path: register a new user → sidebar flips from anonymous (Login/Register) to signed-in (avatar + 5 icons) within one second.
- Logout path: click Logout icon → routed to `/login` with sidebar now hidden (auth-route rule).

### 4.3 Feature Testing & Regression (FTR slice)

Owned by `testing-expert` at the end of implementation. Covers each AC in `functional-spec.md` with `@spec: 013-sidebar-layout` + `@regression` annotations. Includes RED validation per the testing-expert protocol.
