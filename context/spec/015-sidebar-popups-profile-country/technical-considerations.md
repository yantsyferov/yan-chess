# Technical Specification: Sidebar Popups + Profile + Country

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Draft
- **Author(s):** AWOS /awos:tech (orchestrator)

---

## 1. High-Level Technical Approach

Four `Popover`-based mini-popups anchored to each sidebar action icon. Reuse `@radix-ui/react-popover` (new dep? — check if already in bundle via @radix-ui/react-dropdown-menu). Popups float right of the sidebar at the clicked icon's vertical position (`side="right" align="start"`). Only one popup open at a time via shared Zustand store `useSidebarPopupStore` tracking `openPopup: 'settings' | 'friends' | 'chat' | 'notifications' | null`.

Settings popup absorbs today's standalone Theme toggle, Language switcher, and the temporary Logout icon from spec 013. `SidebarSignedInBottom` is cleaned up: only 4 action icons remain (down from 5), no standalone Theme or Language at the bottom.

Country is persisted as a nullable ISO 3166-1 alpha-2 string on `User`. New Prisma migration adds `country String? @db.VarChar(2)`. Sign-up form gets a required Country field (searchable dropdown with flag emojis via a bundled `countries.ts` JSON module). Profile page gets a Country selector that saves immediately on change via `PATCH /users/me { country }`. Existing users with NULL country display as "International" + white flag emoji 🏳.

Profile page is restructured: identity card (avatar + nickname + country selector) + ratings table + history.

Scope: `apps/web/src/features/sidebar-popups/*` (new), `apps/web/src/components/ui/sidebar/SidebarSignedInBottom.tsx` (big amend), `apps/web/src/pages/Profile.tsx` (amend), `apps/web/src/pages/Register.tsx` (amend), `apps/web/src/features/profile/CountryPicker.tsx` (new), `apps/web/src/data/countries.ts` (new), `apps/api/src/modules/users/*` (amend PATCH /users/me to accept country), `apps/api/prisma/schema.prisma` (add country column), `packages/shared/src/schemas/*` (amend register + updateMe schemas).

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Shared package changes

| File | Change |
|---|---|
| `packages/shared/src/schemas/auth.ts` | `registerSchema` gains required `country: z.string().length(2)` (ISO alpha-2) |
| `packages/shared/src/schemas/users.ts` | `updateMeSchema` gains optional `country: z.string().length(2).nullable().optional()` |
| `packages/shared/src/types/users.ts` _(amend or create)_ | `UserMeDto` gains `country: string \| null` |

### 2.2 Prisma migration

Migration `20261016_add_user_country`:

| Change | Shape |
|---|---|
| New column | `User.country String? @db.VarChar(2)` — nullable, no default, no backfill |
| Index | None |

Fly `release_command` auto-applies.

### 2.3 Countries data module

`apps/web/src/data/countries.ts` — bundled JSON array of ISO 3166-1 alpha-2 country records:

```ts
export interface CountryEntry {
  code: string;        // ISO alpha-2 (e.g., "MX")
  flag: string;        // flag emoji (e.g., "🇲🇽")
  names: {             // localized names
    en: string;
    ru: string;
    es: string;
  };
}
export const COUNTRIES: CountryEntry[] = [ ... ];
```

~250 countries. Bundle size ~15-20KB uncompressed. **Assumption:** use a seed list from a public ISO data source (e.g., npm `i18n-iso-countries` or a manually-maintained JSON). To keep the frontend bundle lean, inline a hand-curated list rather than importing a 500KB library.

### 2.4 Sidebar popups infrastructure

| File | Status | Purpose |
|---|---|---|
| `apps/web/src/features/sidebar-popups/useSidebarPopupStore.ts` | new | Zustand store `{ openPopup, open(id), close(), toggle(id) }` |
| `apps/web/src/features/sidebar-popups/SidebarPopup.tsx` | new | Wrapper component — Radix Popover with `side="right" align="start"`, controlled by store |
| `apps/web/src/features/sidebar-popups/SettingsPopup.tsx` | new | Language + Theme + Sign out |
| `apps/web/src/features/sidebar-popups/FriendsPopup.tsx` | new | Quick friend list (max 10) + link to /friends |
| `apps/web/src/features/sidebar-popups/ChatPopup.tsx` | new | "Chat coming soon" placeholder |
| `apps/web/src/features/sidebar-popups/NotificationsPopup.tsx` | new | "You're all caught up." placeholder |

### 2.5 SidebarSignedInBottom cleanup

| File | Status | Purpose |
|---|---|---|
| `apps/web/src/components/ui/sidebar/SidebarSignedInBottom.tsx` | amend | Remove: 5th Logout icon, standalone ThemeToggle, standalone LanguageSwitcher. Add: Popover trigger wiring on 4 remaining icons via useSidebarPopupStore. |

The amended structure (signed-in):
1. Avatar + nickname row (unchanged, → /profile)
2. 4 action icons row (Settings / Friends / Chat / Notifications) — each wrapped in Popover + controlled by store
3. (empty — Theme + Language + Logout all gone from here)

### 2.6 CountryPicker component

| File | Status | Purpose |
|---|---|---|
| `apps/web/src/features/profile/CountryPicker.tsx` | new | Searchable dropdown with flag + country-name. Uses existing Radix Popover + Command pattern (or Combobox if present). Takes `value: string \| null`, `onChange(code: string)`, `locale` prop. Renders localized names via COUNTRIES data module. Flag emoji inline. |

### 2.7 Registration form change

| File | Status | Purpose |
|---|---|---|
| `apps/web/src/pages/Register.tsx` | amend | Add CountryPicker field below password-confirm. Required (submit disabled until picked). Submit payload includes `country: string`. |

### 2.8 Profile page redesign

| File | Status | Purpose |
|---|---|---|
| `apps/web/src/pages/Profile.tsx` | amend | New top identity card: Avatar (placeholder, from existing component) + nickname + CountryPicker (reads user.country, calls PATCH /users/me on change). Ratings table below. GameHistorySection below. "International" + 🏳 display for null country. |

### 2.9 Backend changes

| File | Status | Purpose |
|---|---|---|
| `apps/api/prisma/schema.prisma` | amend | `User.country String? @db.VarChar(2)` |
| `apps/api/src/modules/users/users.service.ts` | amend | `UserMeDto.country: string \| null`; `updateMe({ country })` accepts country |
| `apps/api/src/modules/users/users.controller.ts` | amend | PATCH /users/me pipe validates against new `updateMeSchema` |
| `apps/api/src/modules/auth/auth.service.ts` | amend | `register()` stores `country` from payload |

### 2.10 i18n keys

Under `common.json` (sidebar popups shared infra) + `profile.json` (profile page) + `auth.json` (register):

- Popups: `popups.settings.{title,language,theme,signOut}`, `popups.friends.{title,countLabel,emptyTitle,emptyBody,findFriendsButton,openFullPage}`, `popups.chat.{title,description}`, `popups.notifications.{title,emptyState}`
- Profile: `profile.identityCard.{countryLabel,saved}`, `profile.countryInternational`
- Register: `register.country.{label,placeholder,required}`

### 2.11 Localized country names

The COUNTRIES data module stores names in EN/RU/ES. For a complete 250-country list, maintaining 3 languages × 250 entries by hand is prohibitive but accepting machine-translation imperfection is fine (user already accepted this trade-off for the i18n MVP). For this spec: use the top ~50 most-populous countries' names fully translated + fall back to English name for less-common ones (acceptable gap documented in-code).

### 2.12 Removal of temporary Logout icon

`SidebarSignedInBottom.tsx` had a 5th icon (Logout) added in spec 013 as temporary. This spec removes it — grep for the `// REMOVED in spec 015 — moved to Settings popup` comment to locate.

### 2.13 Testing surfaces

- `apps/web/src/features/sidebar-popups/__tests__/SettingsPopup.test.tsx` — language switch inside popup updates whole UI; theme switch works; sign-out routes to /login.
- `apps/web/src/features/sidebar-popups/__tests__/FriendsPopup.test.tsx` — list rendering; empty state; 10-row cap; link to /friends.
- `apps/web/src/features/sidebar-popups/__tests__/useSidebarPopupStore.test.ts` — only one popup open at a time; toggle semantics.
- `apps/web/src/features/profile/__tests__/CountryPicker.test.tsx` — search filtering; flag emoji visible; onChange payload.
- `apps/web/src/pages/__tests__/Register.country.test.tsx` — submit disabled without country; valid submit includes country code.
- `apps/web/src/pages/__tests__/Profile.identity.test.tsx` — identity card renders; "International" shown for null country; country selector saves via PATCH.
- `apps/api/test/e2e/register-country.e2e.spec.ts` — register with country=MX; GET /users/me returns country=MX; PATCH /users/me { country: "FR" } updates.
- `apps/api/test/e2e/legacy-user-country-null.e2e.spec.ts` — pre-existing user record (country NULL) returns null from GET /users/me; PATCH sets it successfully.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Prisma migration before API code.** Fly release_command handles it. Nullable column with no default — zero backfill, zero mid-deploy issue.
- **@radix-ui/react-popover** — likely already present via dropdown-menu. If not, add dependency (small ~5KB).
- **Countries data** — bundled module ~15-20KB. Acceptable at bundle level.
- **Shared package schemas** — register payload gains required field; existing registration integration tests must be updated.

### 3.2 Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Removing standalone Theme/Language from sidebar bottom may surprise users who learned them in spec 013 | Settings popup clearly surfaces them; one-time UX adjustment |
| Country required at register may block signup if the dropdown is laggy on slow devices | 250 options with native filter — negligible perf. Fallback: expose a sensible default (e.g., first alphabetical) if truly bad |
| Localized country names only for top 50 | Document gap; English fallback for remaining ~200. Future spec can expand. |
| Avatar upload NOT included — users may expect it | Spec explicitly out-of-scope; display-only avatar continues from spec 013. Tooltip "coming soon" optional |
| Existing users have NULL country — "International" display must look intentional, not broken | White-flag emoji 🏳 + "International" text is clearly a designed placeholder, not a bug |
| Chat/Notifications popups are placeholders — users may click repeatedly expecting content | "Chat coming soon" + "You're all caught up." text is unambiguous |

---

## 4. Testing Strategy

- Vitest + RTL for all frontend tests.
- Reuse existing test-i18n fixtures from spec 012.
- New unit + integration tests per the §2.13 list.
- E2E tests on api cover register with country + PATCH /users/me + legacy NULL country handling.
- FTR slice at end covers each AC from functional-spec.md §2.1-§2.11.

### Live smoke (Verify slice, Playwright MCP)

- Click Settings icon → popup opens with Language + Theme + Sign out.
- Click Friends icon → popup opens with bob (test friend) + "Open full Friends page" link.
- Click Chat icon → "Chat coming soon" visible.
- Click Notifications icon → "You're all caught up." visible.
- Sign up a new user with country=Mexico → verify-email → sign in → profile shows "Mexico" + 🇲🇽 flag.
- Open alice's profile (existing user with no country) → "International" + 🏳 shown → change to Spain → identity card updates immediately.
- Open Settings popup, click Sign out → redirected to /login with sidebar in anonymous mode.
