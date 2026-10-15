# Technical Specification: Internationalization — i18n MVP for YanChess

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Completed
- **Author(s):** AWOS /awos:tech (orchestrator + react-frontend + nestjs-backend specialists)

---

## 1. High-Level Technical Approach

Introduce `react-i18next` on the frontend as the translation runtime, extract the ~509 inline English UI strings into per-namespace JSON files for `en`/`ru`/`es`, and add a Header language switcher that writes to a new `useLangStore` Zustand store (localStorage + background PATCH to the API). Persist the chosen language on the server as a new nullable `User.lang` enum column so sign-in on a new device syncs automatically. Move the three transactional email templates (verify, password-reset, resend-verify) out of `auth.service.ts` into standalone per-template modules with `{ en, ru, es }` lookup tables, selected at send time by the user's recorded language (or `en` fallback). Normalize all Zod validation errors in the shared package to **stable error codes** so the UI can map them to localized strings through a `errors` namespace. First-visit auto-detection is wired as an inline synchronous script in `index.html` (same FOUC-prevention pattern as the theme switcher), falling back to `navigator.language` → `en`.

Scope touches `apps/web` (biggest surface), `apps/api/src/modules/mail/*`, `apps/api/src/modules/users/*`, `apps/api/src/modules/auth/*`, `apps/api/prisma/schema.prisma`, and `packages/shared/{schemas,types}/*`.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Shared package changes

Centralize the lang union + supported set as the single source of truth consumed by every other package.

| File | Export | Purpose |
|---|---|---|
| `packages/shared/src/types/lang.ts` _(new)_ | `type Lang = 'en' \| 'ru' \| 'es'`, `const SUPPORTED_LANGS = ['en','ru','es'] as const` | Union + runtime list |
| `packages/shared/src/schemas/users.ts` _(new)_ | `UpdateMeSchema = z.object({ lang: z.enum(SUPPORTED_LANGS).optional() })` | DTO for new PATCH endpoint |
| `packages/shared/src/schemas/auth.ts` _(amend)_ | `RegisterSchema` extended with optional `lang: z.enum(SUPPORTED_LANGS).optional()` | Allow lang on register |

**Error-code migration (assumption).** Zod issues currently carry English prose in `message`. Migrate schemas in `packages/shared/src/schemas/*` to attach stable codes via `.refine(..., { message: 'password.too_short' })` style. Frontend `errors.json` namespace maps codes → localized text through a `zodErrorMap` adapter.

### 2.2 Data model / database changes

Prisma migration `20261015000000_add_user_lang`:

| Change | Shape |
|---|---|
| New enum | `enum Lang { en ru es }` |
| New User column | `lang Lang?` — nullable, no default |
| Index | none (read on single-user lookups only) |
| Backfill | none; existing rows stay `NULL` |

`NULL` semantics: "no explicit choice recorded." UI treats this as "fall back to localStorage / navigator.language detection"; email flows treat it as "send in English."

Fly `release_command` applies this migration automatically on deploy (per the post-spec-011 cleanup — see `fly.api.toml`).

### 2.3 API contracts

| Method | Path | Request | Response | Auth |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | `{ email, nickname, password, confirmPassword, lang? }` | `201 { user }` | none |
| `POST` | `/api/v1/auth/forgot-password` | `{ email }` | `204` (silent) | none |
| `GET` | `/api/v1/users/me` | — | `UserMeDto` incl. new `lang: 'en'\|'ru'\|'es'\|null` | JWT |
| `PATCH` | `/api/v1/users/me` _(new)_ | `{ lang?: 'en'\|'ru'\|'es' }` | updated `UserMeDto` | JWT |

`AuthService.register()` writes `lang` on the new row when present. `AuthService.forgotPassword()` reads `user.lang` after email lookup and passes it to the mailer; `null` becomes `'en'`.

### 2.4 Component breakdown — frontend

| File | Purpose |
|---|---|
| `apps/web/src/i18n/index.ts` _(new)_ | Boots i18next with 3 inlined locale bundles, exports configured instance |
| `apps/web/src/i18n/locales/{en,ru,es}/{common,auth,game,history,friends,profile,errors}.json` _(new)_ | Per-namespace translation files (7 namespaces × 3 locales = 21 files) |
| `apps/web/src/i18n/locales/README.md` _(new)_ | Notes on translation provenance (RU/ES marked "machine-assisted, review needed") |
| `apps/web/src/features/i18n/useLangStore.ts` _(new)_ | Zustand store: `{ current, setLang }` — calls i18n.changeLanguage, persists to localStorage, fires background PATCH when signed in |
| `apps/web/src/features/i18n/LanguageSwitcher.tsx` _(new)_ | Radix dropdown; trigger shows `EN/RU/ES`; items show endonyms + `Check` icon on active row |
| `apps/web/src/lib/zodErrorMap.ts` _(new)_ | Adapter for react-hook-form resolver: translates Zod issue codes → `t('errors:code')` |
| `apps/web/src/components/ui/Header.tsx` _(amend)_ | Mount `<LanguageSwitcher />` sibling to `<ThemeToggle />`, same `gap-2` cluster |
| `apps/web/index.html` _(amend)_ | Inline script: read `localStorage['yanchess:lang']` or map `navigator.language` → `en/ru/es` → set `<html lang>` synchronously (FOUC guard) |
| `apps/web/src/features/auth/useAuthStore.ts` _(amend)_ | On session resolve: if `user.lang` set → `useLangStore.getState().setLang(user.lang)` (overrides local); if null → no-op |

**i18next detection order:** `localStorage['yanchess:lang']` → `navigator.language` mapped (prefix match: `ru*`→`ru`, `es*`→`es`, else `en`) → hardcoded fallback `en`. User.lang applies imperatively after auth resolves, not through the detector plugin.

**Library versions:** `react-i18next ^14.x`, `i18next ^23.x`, `i18next-browser-languagedetector ^8.x`. Bundle impact ~15 KB gz for the core + ~150 KB JSON for all three locales (inlined, no HTTP backend).

**Rejected alternative:** FormatJS/react-intl. Reason: ~40 KB gz core + ICU authoring overhead not justified for EN/RU/ES without complex plural edge cases.

### 2.5 Component breakdown — backend

| File | Purpose |
|---|---|
| `apps/api/prisma/schema.prisma` _(amend)_ | Add `Lang` enum + `User.lang` nullable column |
| `apps/api/src/modules/mail/mail.service.ts` _(amend)_ | Extend `MailMessage` type with optional `lang?: Lang` |
| `apps/api/src/modules/mail/templates/verify-email.ts` _(new)_ | Export `(ctx, lang) => { subject, html }` with `{ en, ru, es }` map; log-and-fallback to `en` for unsupported |
| `apps/api/src/modules/mail/templates/reset-password.ts` _(new)_ | Same shape, for password-reset emails |
| `apps/api/src/modules/mail/templates/resend-verify.ts` _(new)_ | Same shape, for resend-verification emails |
| `apps/api/src/modules/auth/auth.service.ts` _(amend)_ | Replace inline template strings with calls to the three template functions, passing `user.lang ?? 'en'` |
| `apps/api/src/modules/users/users.controller.ts` _(amend)_ | Add `@Patch('me')` handler, `JwtAuthGuard`, Zod via existing pipe |
| `apps/api/src/modules/users/users.service.ts` _(amend)_ | New `updateMe(userId, dto)` method; add `lang` to `UserMeDto` mapper |

### 2.6 Chess-content localization

- Game-end labels (`CHECKMATE`, `STALEMATE`, `DRAW_BY_AGREEMENT`, `TIMEOUT`, `RESIGNATION`) — enums stay as-is; UI maps each via `t('game:endReason.<value>')`.
- Piece names in `PromotionDialog.tsx` — `t('game:pieces.queen')` etc.
- SAN move notation (`e4`, `Nf3`, `O-O`) — untranslated; universal standard.

### 2.7 Autodetect + FOUC prevention

Inline script added before React mount in `apps/web/index.html`:

```html
<script>
  (function () {
    var stored = localStorage.getItem('yanchess:lang');
    var lang = stored
      || (navigator.language.indexOf('ru') === 0 ? 'ru'
          : navigator.language.indexOf('es') === 0 ? 'es'
          : 'en');
    if (!stored) localStorage.setItem('yanchess:lang', lang);
    document.documentElement.lang = lang;
  })();
</script>
```

Mirrors the theme-switcher inline pattern. After mount, i18next picks up the same key through its localStorage detector.

### 2.8 Sign-in cross-device sync

On successful sign-in (`useAuthStore` reaction):
1. Fetch `GET /users/me` → `user.lang` either `'en'|'ru'|'es'` or `null`.
2. If non-null → `useLangStore.setLang(user.lang)` (overrides local).
3. If null → no server-side write; local stays as-is.

On explicit switch via the dropdown:
1. Update local state + localStorage + i18next synchronously.
2. If signed in → fire-and-forget `PATCH /users/me { lang }`. Swallow all errors silently.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Shared package touches both apps.** Zod error-code migration in `packages/shared/src/schemas/` ripples into api DTO validation + web form validation simultaneously. Mitigation: pair the shared change with its two consumers in a single early slice.
- **Resend SDK** — no change. `subject` + `html` are rendered server-side before `send()`; Resend sees plain localized strings.
- **Fly `release_command`** — already runs `prisma migrate deploy` (post-spec-011 cleanup). New migration ships automatically; no manual step.
- **`<html lang>` attribute** — screen readers + browser spellcheck + Google Translate behavior all key off this. Setting it synchronously via the inline script is critical for a11y.
- **No new environment variables** required.

### 3.2 Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ~509 strings bulk extraction misses keys in less-visited components | Run `i18next-parser` after extraction to surface any `t(...)` call missing in a locale JSON; also surface untranslated inline strings via a lint pass |
| Translation quality — RU/ES authored by developer best-effort | `apps/web/src/i18n/locales/README.md` flags both as "machine-assisted, review needed"; i18next falls back to `en` for missing keys so partial coverage never breaks the UI |
| Enum sync drift between Prisma + Zod + shared types | Single source of truth in `packages/shared/src/types/lang.ts`; both Prisma + Zod derive their values from `SUPPORTED_LANGS` constant |
| First-paint flash of English before i18next init resolves | Inline `<script>` in `index.html` sets `<html lang>` synchronously; accept a one-frame visible-text flash for v1 — eliminate in a follow-up if objectionable |
| Future language addition (e.g., `fr`) requires three coordinated changes (enum migration + shared constant + templates) | `assertNever`/log-fallback pattern in templates prevents silent breakage; a new-language checklist lives in the i18n `README.md` |
| Zod error-code migration risks breaking api error responses that currently return English messages | Keep the English `message` string in Zod issues as a fallback; add a `code` field via `params` so new consumers (web) use codes while existing api behavior stays intact |
| Prod rollout bundles 150 KB of extra JSON into the main chunk | Acceptable on first ship — revisit lazy loading via `i18next-http-backend` only if bundle grows past 500 KB post-translation |
| User's `User.lang` could be set to a value the current build doesn't support (e.g., row from a future migration) | Mailer + UI both log + fall back to `en`; never 500 |

---

## 4. Testing Strategy

### 4.1 Frontend (`apps/web/`, Vitest + React Testing Library)

- **`apps/web/src/test/i18n-test-utils.ts`** _(new)_ — fixture that creates a pre-initialized `i18next` instance with all 3 locales inlined; no async `init` needed.
- **Component tests** — wrap in `<I18nextProvider i18n={testI18n}>`, call `testI18n.changeLanguage('ru' | 'es')` before render. Coverage targets:
  - `Header.tsx` renders correct strings in RU + ES.
  - `Login.tsx` renders form labels + validation errors in RU + ES (checks the Zod error-code path end-to-end).
- **Store tests** — `useLangStore.spec.ts`: `setLang` calls i18next, writes localStorage, fires PATCH when signed in, no PATCH when signed out; sign-in merge: overrides local when `user.lang` is set, no-op when null.
- **Expected count delta:** 278 → ~290 web tests.

### 4.2 Backend (`apps/api/`, Vitest)

- **Unit (`test/unit/`):**
  - `mail-templates.spec.ts` — for each of the 3 templates × 3 langs: substring assertions on `subject` and `html` for localized key phrases. Assert `'en'` fallback on invalid lang.
  - `patch-users-me.spec.ts` — `JwtAuthGuard` blocks unauthenticated; Zod rejects invalid lang; `UsersService.updateMe` writes to Prisma; response has updated `lang`.
- **E2E (`test/e2e/`):**
  - Register with `{ lang: 'ru' }` → inspect dev-outbox JSON file for a Russian subject line.
  - Password-reset for a user whose stored `lang` is `'es'` → outbox email has Spanish subject.
  - `PATCH /users/me { lang: 'es' }` → `GET /users/me` returns `lang: 'es'`.
- **Expected count delta:** 113 → ~121 api unit; 76 → ~79 api e2e.

### 4.3 Feature-level acceptance + regression (FTR slice)

Done by `testing-expert` at the end of implementation. Covers each AC in the functional spec with a `@spec: 012-i18n` + `@regression` test. Includes a RED validation pass per the testing-expert protocol.

### 4.4 Live smoke (Verify slice, Playwright MCP)

- Set browser locale to `ru-RU` → first-visit of yan-chess.com renders in Russian.
- Switch to English via the Header → page updates in place, Header badge shows `EN`.
- Reload → still English (localStorage persisted).
- Sign in on another browser whose `User.lang` is `es` → page switches to Spanish within one second.
- Register a new user with the UI in Russian → inspect dev-outbox: email arrives in Russian.
