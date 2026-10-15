# Locales

Translation files per supported language. Namespace per file.
RU and ES translations in this folder are machine-assisted developer translations pending human review.
English is the source of truth — missing keys in RU/ES fall back to EN at runtime via i18next.

## Namespaces

| File          | Surfaces                                              | Added in spec  |
|---------------|-------------------------------------------------------|----------------|
| `common.json` | Shared primitives, play/searching/notFound strings    | 012-i18n       |
| `auth.json`   | Login, Register, ForgotPassword, ResetPassword, Email | 012-i18n       |
| `errors.json` | Zod / API error messages                              | 012-i18n       |
| `game.json`   | Board, clocks, hotseat/vs-bot dialogs, online result  | 012-i18n       |
| `profile.json`| Profile page                                          | 012-i18n       |
| `history.json`| Game history, filters, pagination, replay             | 012-i18n       |
| `friends.json`| Friends list, requests, search, challenge modal       | 012-i18n       |

## Intentional leftovers after Slice 4

The grep sweep `grep -rE ">[A-Z][a-z][^<>{}]+<" apps/web/src --include=*.tsx` still shows these strings
that are intentionally deferred:

| File                                  | String                   | Reason / Deferred to      |
|---------------------------------------|--------------------------|---------------------------|
| `src/routes.tsx`                      | `Loading...`             | Suspense fallback, minor, future sweep |
| `src/features/auth/ProtectedRoute.tsx`| `Loading…`               | Auth infra; Slice 2 did not cover ProtectedRoute |
| `src/features/vs-bot/VsBotBoard.tsx`  | `Loading game...`, `Moves` | vs-bot surface; missed in Slice 3 |
| `src/pages/Game.tsx`                  | `Game`                   | Hotseat page title; not in scope for Slices 1–4 |
| `src/pages/Home.tsx`                  | `Ready for a game?`      | Home page; not explicitly in scope for Slices 1–4 |
| `src/pages/VerifyEmailCheck.tsx`      | `Check your email`, `The link is valid for 24 hours.` | Auth page; missed in Slice 2 |

ARIA labels (`aria-label="..."`) for icon-only buttons throughout the codebase remain in English
pending the next sweep (documented in spec 012-i18n §2.9).
