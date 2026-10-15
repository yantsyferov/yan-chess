# Tasks — Spec 012-i18n (Internationalization)

Vertical slice plan. Each slice ends with a Verify task that drives the slice end-to-end and deletes its own ephemeral artifacts. The final slice is the standing Feature Testing & Regression suite.

The app must remain runnable after every slice. Translation files start skeletal and grow slice by slice — missing keys fall back to English via i18next, so partial coverage never breaks the UI.

---

- [x] **Slice 1: i18n foundation + translated Header + working switcher**

  > Install react-i18next, scaffold locale namespaces, add the Header language switcher with autodetect + localStorage persistence. Only Header + nav strings are translated — everything below the Header stays English for now (i18next falls back automatically).

  - [x] Add `react-i18next@^14`, `i18next@^23`, `i18next-browser-languagedetector@^8` to `apps/web/package.json` dependencies; run `pnpm install`; rebuild. **[Agent: react-frontend]**
  - [x] Create `packages/shared/src/types/lang.ts` exporting `type Lang = 'en' | 'ru' | 'es'` + `SUPPORTED_LANGS` tuple; re-export from `packages/shared/src/index.ts`; rebuild shared package. **[Agent: nestjs-backend]**
  - [x] Create `apps/web/src/i18n/index.ts` initializing i18next with the three locale bundles inlined; detection order localStorage → navigator.language mapped → en. Export the configured instance. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/i18n/locales/{en,ru,es}/common.json` with Header + nav keys (`header.hotseat`, `header.vsBot`, `header.friends`, `header.profile`, `header.signIn`, `header.signUp`, `header.signOut`, `header.appName`, `header.menuAriaLabel`, and language names `languages.en`/`languages.ru`/`languages.es`). Translate en, ru, es. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/i18n/locales/README.md` noting RU and ES are machine-assisted translations pending human review. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/i18n/useLangStore.ts` — Zustand store with `{ current, setLang }`. `setLang` calls `i18n.changeLanguage`, writes `localStorage['yanchess:lang']`, no backend call yet (added in Slice 5). **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/i18n/LanguageSwitcher.tsx` — Radix dropdown trigger showing `EN`/`RU`/`ES`, items with endonyms + `Check` icon on active. Mount in `apps/web/src/components/ui/Header.tsx` as a sibling of `<ThemeToggle />`. **[Agent: react-frontend]**
  - [x] Replace inline strings in `apps/web/src/components/ui/Header.tsx` (and its mobile dropdown) with `t('common:header.*')` calls. **[Agent: react-frontend]**
  - [x] Add inline FOUC script in `apps/web/index.html` that reads `localStorage['yanchess:lang']`, maps `navigator.language` (`ru*`→`ru`, `es*`→`es`, else `en`), writes the key back if missing, and sets `document.documentElement.lang`. **[Agent: react-frontend]**
  - [x] Wrap `apps/web/src/main.tsx` root with `<I18nextProvider i18n={i18n}>` and ensure i18n is imported for its side effects. **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/i18n/__tests__/useLangStore.test.ts` — asserts `setLang` persists to localStorage and calls i18next changeLanguage. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run` passes; `pnpm --filter web build` succeeds; dev-start the web app, drive it in a browser via Playwright MCP, open Header switcher, confirm switching EN/RU/ES changes nav text + persists after reload + autodetects RU on a browser whose navigator.language starts with "ru". Stop the dev server by PID when done; delete any screenshots or recordings produced. **[Agent: general-purpose]**

---

- [ ] **Slice 2: Translate the auth flow + migrate Zod schemas to error codes**

  > Localize Login, Register, VerifyEmail, ForgotPassword, ResetPassword. Introduce stable error codes in `packages/shared/src/schemas/auth.ts` so form-validation messages can be translated through the `errors` namespace.

  - [ ] Create `apps/web/src/i18n/locales/{en,ru,es}/auth.json` and `errors.json` with keys for all five auth pages (page titles, form labels, buttons, inline hints, success/failure messages, email-verification banners). Translate in all three locales. **[Agent: react-frontend]**
  - [ ] Update `packages/shared/src/schemas/auth.ts` — attach stable `params: { i18nKey: 'password.too_short' }` style metadata to every validation issue; keep the English `message` as the dev-friendly fallback. Rebuild shared package. **[Agent: nestjs-backend]**
  - [ ] Create `apps/web/src/lib/zodErrorMap.ts` — custom Zod error map that reads `params.i18nKey` from issues and returns the result of `i18n.t('errors:<key>')`; falls through to the issue's default message if no key is present. Install it globally via `z.setErrorMap(zodErrorMap)` from `apps/web/src/i18n/index.ts`. **[Agent: react-frontend]**
  - [ ] Replace inline strings in `apps/web/src/pages/Login.tsx`, `Register.tsx`, `VerifyEmail.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` with `t('auth:*')` / `t('errors:*')` calls. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/__tests__/auth-i18n.test.tsx` — renders `Login.tsx` and `Register.tsx` under `<I18nextProvider>` with `ru` and `es` locales set; asserts form labels + a sample validation error render in the chosen language. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run` passes; dev-start the web app, Playwright-drive /login + /register in all three languages, submit forms with invalid inputs, confirm validation copy localized correctly. Stop dev server by PID, delete artifacts. **[Agent: general-purpose]**

---

- [ ] **Slice 3: Translate game surfaces (board, promotion, end-of-game, vs-bot setup, hotseat page)**

  > Localize `pages/Game.tsx`, `pages/VsBot.tsx`, `features/vs-bot/VsBotSetup.tsx`, `components/game/*` (MoveHistory, PromotionDialog, DrawOfferDialog, ConfirmResignDialog, GameActions, GameClock, GameEndModal). SAN notation remains untouched.

  - [ ] Create `apps/web/src/i18n/locales/{en,ru,es}/game.json` with keys for all board controls, end-of-game labels (`endReason.checkmate`, `endReason.stalemate`, etc.), piece names (`pieces.queen`, etc.), draw-offer dialog, resign confirmation, clocks, and vs-bot setup options. Translate in all three locales. **[Agent: react-frontend]**
  - [ ] Replace inline strings in `apps/web/src/pages/Game.tsx`, `pages/VsBot.tsx`, `features/vs-bot/VsBotSetup.tsx`, and every file under `apps/web/src/components/game/` with `t('game:*')` calls. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/components/game/__tests__/GameActions.i18n.test.tsx` — asserts Resign + Offer-draw labels render in Russian when i18n language is `ru`. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run` passes; drive /vs-bot setup + play one move + end game in Spanish via Playwright MCP, confirm UI copy localized. Stop dev server, delete artifacts. **[Agent: general-purpose]**

---

- [ ] **Slice 4: Translate the remaining surfaces (Profile, History, Friends, OnlineBoard, ChallengeModal, 404)**

  > Localize the three remaining feature namespaces plus the matchmaking / online board. After this slice the UI contains no inlined user-facing English prose.

  - [ ] Create `apps/web/src/i18n/locales/{en,ru,es}/profile.json`, `history.json`, `friends.json` with keys for every user-visible string in the matching features. Translate in all three locales. **[Agent: react-frontend]**
  - [ ] Replace inline strings in `apps/web/src/pages/Profile.tsx`, `pages/Play.tsx`, `pages/NotFound.tsx` (if present), and every file under `apps/web/src/features/history/`, `features/friends/`, `features/online/`. **[Agent: react-frontend]**
  - [ ] Add remaining `common.json` keys for shared primitives (empty states, generic buttons like "Cancel"/"Close"/"Save", confirmation dialog defaults, toast titles) if any emerged during the extraction. **[Agent: react-frontend]**
  - [ ] Run a sweep: `grep -rE ">[A-Z][a-z][^<>{}]+<" apps/web/src --include=*.tsx | grep -v test | grep -v node_modules` should return a trivially small set (icon alt labels, aria-labels permitted). Document any intentional English leftovers in a comment at the top of `apps/web/src/i18n/locales/README.md`. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run` passes; `pnpm --filter web build` succeeds; Playwright-drive /profile, /play (matchmaking screen), friends search in Russian; confirm no English leaks visible to the user. Stop dev server, delete artifacts. **[Agent: general-purpose]**

---

- [ ] **Slice 5: Backend User.lang persistence + register lang + PATCH /users/me + sign-in merge**

  > Add the Prisma `Lang` enum + nullable `User.lang` column. Register endpoint accepts optional lang. New PATCH /users/me endpoint. Frontend fires PATCH on explicit switch when signed in, and merges on sign-in: `User.lang` → overrides local; null → keep local.

  - [ ] Create Prisma migration `apps/api/prisma/migrations/<ts>_add_user_lang/` — add `enum Lang { en ru es }` + `lang Lang?` on User. Apply locally via `pnpm --filter api prisma:migrate:dev`. **[Agent: postgres-redis-data]**
  - [ ] Update `packages/shared/src/schemas/auth.ts` — add optional `lang: z.enum(SUPPORTED_LANGS).optional()` to `RegisterSchema`. Create `packages/shared/src/schemas/users.ts` exporting `UpdateMeSchema = z.object({ lang: z.enum(SUPPORTED_LANGS).optional() })`. Rebuild shared. **[Agent: nestjs-backend]**
  - [ ] Update `apps/api/src/modules/auth/auth.service.ts` — `register()` writes `lang` to the new User row when present. **[Agent: nestjs-backend]**
  - [ ] Update `apps/api/src/modules/users/users.controller.ts` — add `@Patch('me')` guarded by `JwtAuthGuard`, validated by `UpdateMeSchema`. Add `UsersService.updateMe(userId, dto)` that updates `User.lang`. **[Agent: nestjs-backend]**
  - [ ] Update `UserMeDto` + mapper in `apps/api/src/modules/users/users.service.ts` to include `lang: Lang | null`. **[Agent: nestjs-backend]**
  - [ ] Update `apps/web/src/features/i18n/useLangStore.ts` — `setLang` now fires fire-and-forget `PATCH /api/v1/users/me { lang }` when `useAuthStore.getState().user` is non-null; swallow all errors silently. **[Agent: react-frontend]**
  - [ ] Update `apps/web/src/features/auth/useAuthStore.ts` — after a successful `/users/me` fetch on sign-in, if `user.lang` is set, call `useLangStore.getState().setLang(user.lang)` with a flag that skips the follow-up PATCH (to avoid a redundant write). **[Agent: react-frontend]**
  - [ ] Add `apps/api/test/unit/patch-users-me.spec.ts` — guard behavior + Zod validation + sets User.lang. **[Agent: nestjs-backend]**
  - [ ] Add `apps/api/test/e2e/users-me-lang.e2e.spec.ts` — register user, PATCH their lang to `es`, GET /users/me returns `lang: 'es'`. **[Agent: nestjs-backend]**
  - [ ] Verify: `pnpm --filter api test:unit` + `pnpm --filter api test:e2e` pass. Then dev-start full stack; register a new user with the web UI in Russian; sign out; sign back in on a fresh browser profile; confirm the UI switches to Russian automatically. Stop servers by PID, delete artifacts. **[Agent: general-purpose]**

---

- [ ] **Slice 6: Localized transactional emails**

  > Extract inline email HTML from `auth.service.ts` into dedicated template modules with `{ en, ru, es }` maps. Pass `user.lang ?? 'en'` into the templates. Register-flow email uses the lang submitted on registration; password-reset uses the lang stored on the user's account.

  - [ ] Extend `MailMessage` in `apps/api/src/modules/mail/mail.service.ts` with optional `lang?: Lang`. No signature change to `send()`. **[Agent: nestjs-backend]**
  - [ ] Create `apps/api/src/modules/mail/templates/verify-email.ts`, `reset-password.ts`, `resend-verify.ts` — each exports a function `(ctx, lang) => { subject, html }` backed by a `Record<Lang, {...}>`. Unsupported lang → log warn + fall back to `en`. **[Agent: nestjs-backend]**
  - [ ] Update `apps/api/src/modules/auth/auth.service.ts` to call the three template functions with `user.lang ?? 'en'` instead of using inline template strings. Remove the obsolete inline template strings. **[Agent: nestjs-backend]**
  - [ ] Add `apps/api/test/unit/mail-templates.spec.ts` — for each of the three templates × three langs, assert the subject + html contain the expected localized key phrases (substring checks); assert the `en` fallback on invalid lang. **[Agent: nestjs-backend]**
  - [ ] Add `apps/api/test/e2e/register-email-lang.e2e.spec.ts` — POST /auth/register with `lang: 'ru'`; read the latest file in `apps/api/dev-outbox/`; assert the subject contains the Russian phrase and the HTML contains the Russian CTA. **[Agent: nestjs-backend]**
  - [ ] Verify: `pnpm --filter api test:unit` + `test:e2e` pass. Then dev-start, register a user through the web UI in Spanish, confirm the dev-outbox file contains Spanish subject + body. Stop servers, delete artifacts. **[Agent: general-purpose]**

---

- [ ] **Slice 7: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.

  - [ ] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 012-i18n` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [ ] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
