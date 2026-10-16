# Tasks — Spec 015-sidebar-popups-profile-country

Vertical slice plan. Each slice ends with a Verify checkpoint. Final slice is FTR.

Agents: `react-frontend`, `nestjs-backend`, `postgres-redis-data`, `testing-expert`, `general-purpose`.

---

- [ ] **Slice 1: Country column on User + API endpoints accept/return it (foundation)**

  > Add `User.country String?` nullable column. Extend `registerSchema` + `updateMeSchema` with country. API persists + returns it. Zero visible UI change. Prep for later slices.

  - [ ] Prisma migration `20261016_add_user_country` — add `country String? @db.VarChar(2)` to User model. Apply dev + test DBs. **[Agent: postgres-redis-data]**
  - [ ] Amend `packages/shared/src/schemas/auth.ts` — `registerSchema` gains REQUIRED `country: z.string().length(2)` field (new users must provide it). Rebuild shared. **[Agent: nestjs-backend]**
  - [ ] Amend `packages/shared/src/schemas/users.ts` — `updateMeSchema` gains OPTIONAL `country: z.string().length(2).nullable().optional()` (profile edit). Rebuild shared. **[Agent: nestjs-backend]**
  - [ ] Amend `apps/api/src/modules/users/users.service.ts` — `UserMeDto` gains `country: string | null`; `updateMe({ country })` writes it; `me()` mapper returns `user.country`. **[Agent: nestjs-backend]**
  - [ ] Amend `apps/api/src/modules/auth/auth.service.ts` — `register()` stores `dto.country` on new user row. **[Agent: nestjs-backend]**
  - [ ] Existing e2e test fixtures that register users — update to include `country: "US"` (or similar) in register payload to pass new schema validation. Grep `apps/api/test/e2e/` for `register` + `email:` patterns to find the fixtures. **[Agent: nestjs-backend]**
  - [ ] Add `apps/api/test/e2e/users-me-country.e2e.spec.ts` — register with country=MX → GET /users/me returns country=MX; PATCH { country: "FR" } → GET returns FR; existing fixture user (country NULL) returns null. **[Agent: nestjs-backend]**
  - [ ] Verify: `pnpm --filter api test:unit` + `pnpm --filter api test:e2e` + `pnpm --filter web build` pass. **[Agent: general-purpose]**

---

- [ ] **Slice 2: Countries data module + CountryPicker component**

  > Bundle a localized country list and build the searchable dropdown with flag emoji. Unused by any page yet — Slices 3 + 4 will plug it in.

  - [ ] Create `apps/web/src/data/countries.ts` — exports `COUNTRIES: CountryEntry[]` with ~250 ISO 3166-1 alpha-2 entries. Each has `{ code, flag, names: { en, ru, es } }`. Top 50 populous countries have full RU/ES translations; remaining fall back to English name (document). Flag emoji from Unicode flag codepoints. **[Agent: react-frontend]**
  - [ ] Create `apps/web/src/features/profile/CountryPicker.tsx` — searchable dropdown (Radix Popover + text input filter). Props: `value: string | null`, `onChange(code: string): void`, `placeholder?: string`. Renders flag emoji + localized country name per row. Reads locale from `useLangStore`. **[Agent: react-frontend]**
  - [ ] Add i18n keys to `apps/web/src/i18n/locales/{en,ru,es}/common.json` — `country.placeholder` ("Select country" / "Выберите страну" / "Selecciona un país"), `country.international` ("International" / "Международный" / "Internacional"), `country.whiteFlag` aria-label. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/features/profile/__tests__/CountryPicker.test.tsx` — search filter narrows list; onChange fires with correct ISO code; selecting a country shows flag inline; placeholder renders when value=null. RED-validate the search filter. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run src/features/profile/__tests__/CountryPicker.test.tsx` passes; `pnpm --filter web build` green. **[Agent: general-purpose]**

---

- [ ] **Slice 3: Register form gains Country field (required)**

  > Add CountryPicker to Register.tsx below password-confirm. Submit disabled until country selected. Payload includes country code.

  - [ ] Amend `apps/web/src/pages/Register.tsx` — add `<CountryPicker>` below password-confirm field; form state tracks `country: string | null`; submit button disabled when country is null; form submit payload includes `country`. Localized label via `auth:register.country.label` + required-validation message `auth:register.country.required`. **[Agent: react-frontend]**
  - [ ] Add i18n keys to `apps/web/src/i18n/locales/{en,ru,es}/auth.json` — `register.country.{label,required}`. **[Agent: react-frontend]**
  - [ ] Extend `apps/web/src/pages/__tests__/auth-i18n.test.tsx` (or add new Register.country.test.tsx) — Country field renders; submit disabled without country; with country filled, submit calls auth with payload including country code. RED-validate. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run` passes; dev-start web preview on 5173, open /register, confirm Country field below password-confirm, type "Mex" to filter, pick Mexico, confirm Submit button enables. Stop preview. **[Agent: general-purpose]**

---

- [ ] **Slice 4: Profile page redesign — identity card + CountryPicker save-on-change**

  > Restructure /profile with identity card (avatar + nickname + CountryPicker) at top, ratings below, history below. CountryPicker saves immediately on change via PATCH /users/me. "International" + 🏳 shown for NULL country.

  - [ ] Amend `apps/web/src/pages/Profile.tsx` — new top section: identity card with avatar (existing Avatar placeholder), nickname, CountryPicker reading `user.country`. On CountryPicker change: call `authedFetch` PATCH /users/me { country: code }. "International" + 🏳 + localized text when country is null. **[Agent: react-frontend]**
  - [ ] Add i18n keys to `apps/web/src/i18n/locales/{en,ru,es}/profile.json` — `identityCard.{countryLabel,saved,international,avatarComingSoon}`. **[Agent: react-frontend]**
  - [ ] Extend `apps/web/src/pages/__tests__/` — new `Profile.identity.test.tsx` or extend existing. Identity card renders; CountryPicker shows current country; selecting new country calls PATCH; "International" shown when null. RED-validate. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run src/pages/__tests__/` passes; dev-start, sign in as alice, visit /profile, confirm identity card at top with avatar + nickname + country selector (NULL → International), change country to Spain → page updates, reload → country still Spain. Stop preview. **[Agent: general-purpose]**

---

- [ ] **Slice 5: Sidebar popups infrastructure (Settings popup + removal of standalone Theme/Lang/Logout)**

  > Add useSidebarPopupStore + SidebarPopup wrapper + SettingsPopup. Wire Settings icon to open popup. REMOVE from SidebarSignedInBottom: 5th Logout icon + standalone ThemeToggle + standalone LanguageSwitcher.

  - [ ] Create `apps/web/src/features/sidebar-popups/useSidebarPopupStore.ts` — Zustand store `{ openPopup, open(id), close(), toggle(id) }`. Only one popup open at a time. **[Agent: react-frontend]**
  - [ ] Create `apps/web/src/features/sidebar-popups/SidebarPopup.tsx` — wrapper component using @radix-ui/react-popover; `side="right" align="start"`. Props: `id: PopupId, trigger: ReactNode, children: ReactNode`. Open state controlled by useSidebarPopupStore.openPopup === id. **[Agent: react-frontend]**
  - [ ] Create `apps/web/src/features/sidebar-popups/SettingsPopup.tsx` — contains LanguageSwitcher (reused, dropdown pattern), ThemeToggle (reused), Sign-out button. Section labels above each. Sign-out calls `authService.logout()` + navigates to /login. **[Agent: react-frontend]**
  - [ ] Amend `apps/web/src/components/ui/sidebar/SidebarSignedInBottom.tsx` — DELETE: standalone ThemeToggle, standalone LanguageSwitcher, 5th Logout icon (the one with `// REMOVED in spec 015` comment). KEEP: avatar+nickname row, 4 action icons row. WRAP Settings icon with SidebarPopup containing SettingsPopup. Other 3 icons (Friends/Chat/Notifications) wrap in placeholder SidebarPopup stubs that will be filled in Slices 6-8. **[Agent: react-frontend]**
  - [ ] Add i18n keys to `apps/web/src/i18n/locales/{en,ru,es}/common.json` — `popups.settings.{title,language,theme,signOut}`. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/features/sidebar-popups/__tests__/useSidebarPopupStore.test.ts` + `SettingsPopup.test.tsx` — only one popup at a time; toggle semantics; language switch inside popup updates whole UI; theme switch works; sign-out routes to /login. RED validate sign-out. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run` passes; `pnpm --filter web build` green; dev-start, sign in as alice, click Settings icon → popup opens on right of sidebar with Language + Theme + Sign out; switch to Spanish → sidebar labels + popup content update; click Sign out → redirect to /login with anonymous sidebar. Confirm sidebar bottom NO LONGER has standalone Theme/Lang/5th Logout icon. Screenshot. Stop preview. **[Agent: general-purpose]**

---

- [ ] **Slice 6: Friends popup**

  > Clicking Friends icon in sidebar opens popup with up to 10 friends + "Open full Friends page" link. Empty state when 0 friends.

  - [ ] Create `apps/web/src/features/sidebar-popups/FriendsPopup.tsx` — reads `useFriendsStore(s => s.friends)`. Renders header "Friends (<count>)". List up to 10 rows (avatar + nickname + online indicator). Empty state with "No friends yet" + "Find friends" button → /friends. Bottom link "Open full Friends page" → /friends. **[Agent: react-frontend]**
  - [ ] Amend `SidebarSignedInBottom.tsx` — wrap Friends icon with SidebarPopup containing FriendsPopup. **[Agent: react-frontend]**
  - [ ] Add i18n keys to `common.json` — `popups.friends.{title,countLabel,emptyTitle,emptyBody,findFriendsButton,openFullPage}`. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/features/sidebar-popups/__tests__/FriendsPopup.test.tsx` — list rendering with mocked friends; empty state when friends=[]; 10-row cap when friends=15; link to /friends renders. RED validate empty state. **[Agent: react-frontend]**
  - [ ] Verify: narrow test passes; dev-start, sign in as alice, click Friends icon → popup with bob visible + "Open full Friends page" link. Stop preview. **[Agent: general-purpose]**

---

- [ ] **Slice 7: Chat + Notifications placeholder popups**

  > Both are "coming soon" / "empty state" placeholders — no real data wired. Chat icon stops being visibly disabled.

  - [ ] Create `apps/web/src/features/sidebar-popups/ChatPopup.tsx` — speech-bubble icon + heading "Chat coming soon" + description text. No input field. **[Agent: react-frontend]**
  - [ ] Create `apps/web/src/features/sidebar-popups/NotificationsPopup.tsx` — header "Notifications" + bell icon + empty state "You're all caught up." **[Agent: react-frontend]**
  - [ ] Amend `SidebarSignedInBottom.tsx` — wrap Chat icon with SidebarPopup containing ChatPopup; REMOVE the `cursor-not-allowed pointer-events-none opacity-50` classes added in spec 013 (icon becomes clickable). Wrap Notifications icon with SidebarPopup containing NotificationsPopup. **[Agent: react-frontend]**
  - [ ] Add i18n keys to `common.json` — `popups.chat.{title,description}`, `popups.notifications.{title,emptyState}`. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/features/sidebar-popups/__tests__/ChatPopup.test.tsx` + `NotificationsPopup.test.tsx` — content renders; Chat icon is enabled (no cursor-not-allowed class). RED validate Chat enable. **[Agent: react-frontend]**
  - [ ] Verify: tests pass; dev-start, sign in as alice, click Chat icon → "Chat coming soon" popup; Chat icon no longer visibly disabled; click Notifications icon → "You're all caught up." popup. Stop preview. **[Agent: general-purpose]**

---

- [ ] **Slice 8: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [ ] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 015-sidebar-popups-profile-country` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [ ] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
