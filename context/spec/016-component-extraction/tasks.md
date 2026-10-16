# Tasks — Spec 016-component-extraction

Pure frontend refactor. Each slice extracts one component and migrates all its call sites. The app remains runnable + visually identical after every slice.

Agents: `react-frontend` (all implementation), `testing-expert` (FTR), `general-purpose` (per-slice verify when needed).

Baseline: 508 web tests, 141 api unit, api e2e unaffected (no backend touch).

---

- [x] **Slice 1: Extract `UserIdentity` + migrate all 7 nickname-render sites**

  > Highest-impact extraction. Centralizes nickname + flag + optional rating + optional online dot into one component. All visible output stays identical.

  - [x] Create `apps/web/src/features/profile/UserIdentity.tsx` with props `{ nickname: string, country: string | null, rating?: number, online?: boolean, size?: 'sm' | 'md' | 'lg', className?: string }`. Renders nickname text + inline `<UserFlag>` + optional ` (rating)` + optional `<OnlineStatusDot>` (if OnlineStatusDot isn't extracted yet in slice 2, inline the dot here first and swap in slice 2). **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/profile/__tests__/UserIdentity.test.tsx` — renders nickname, flag, rating when passed, dot when `online`; size variants apply classes. RED-validate 1 test. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/history/GameRow.tsx` — opponent nickname → `<UserIdentity nickname country rating />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/friends/FriendCard.tsx` — row → `<UserIdentity nickname country online rating />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/friends/SearchResultCard.tsx` — row → `<UserIdentity nickname country rating />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/sidebar-popups/FriendsPopup.tsx` — row → `<UserIdentity nickname country online size="sm" />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/play/InlineChallengeForm.tsx` — friend header → `<UserIdentity nickname country online size="md" />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/play/FriendsLobbyPanel.tsx` — list rows → `<UserIdentity nickname country online />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/features/online/OnlineBoard.tsx` — opponent panel → `<UserIdentity nickname country rating />`. **[Agent: react-frontend]**
  - [x] Migrate `apps/web/src/pages/Profile.tsx` — identity card heading → use `<UserIdentity>` for the nickname+flag inline (CountryPicker stays separate for form edit). **[Agent: react-frontend]**
  - [x] Delete now-unused `<UserFlag>` imports in migrated files (UserIdentity imports UserFlag). **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run` → ≥508 (new tests may add +3-5); `pnpm --filter web build` → green. **[Agent: react-frontend]**

---

- [ ] **Slice 2: Extract `OnlineStatusDot` + `RatedBadge` + consolidate migration**

  > Two small primitives + make UserIdentity use the extracted OnlineStatusDot. Move RatedBadge out of ChallengeToast into components/ui and reuse in GameRow.

  - [ ] Create `apps/web/src/components/ui/OnlineStatusDot.tsx` — `<OnlineStatusDot online size?='sm'|'md' className? />`. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/components/ui/__tests__/OnlineStatusDot.test.tsx` — online → green class, offline → grey class, size prop applies width/height class. **[Agent: react-frontend]**
  - [ ] Create `apps/web/src/components/ui/RatedBadge.tsx` — moved from `features/friends/ChallengeToast.tsx` local `RatedBadge` component. `<RatedBadge isRated size?='sm'|'md' />`. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/components/ui/__tests__/RatedBadge.test.tsx` — Rated label when isRated=true, Casual when false, correct styling per state. **[Agent: react-frontend]**
  - [ ] Migrate `features/friends/ChallengeToast.tsx` — remove local RatedBadge, import from `components/ui/RatedBadge`. **[Agent: react-frontend]**
  - [ ] Migrate `features/history/GameRow.tsx` — replace the inline Rated/Casual span with `<RatedBadge isRated={game.isRated} />`. **[Agent: react-frontend]**
  - [ ] Migrate `features/profile/UserIdentity.tsx` + all 5 original OnlineStatusDot inline sites (FriendsPopup, FriendCard, OnlineBoard, InlineChallengeForm, FriendsLobbyPanel) — replace inline dot JSX with `<OnlineStatusDot online size="sm|md" />`. UserIdentity now imports OnlineStatusDot. **[Agent: react-frontend]**
  - [ ] Verify: tests + build green. **[Agent: react-frontend]**

---

- [ ] **Slice 3: Extract `ToggleGroup` + migrate 3 segment usages**

  > The highest-LOC extraction. Replaces segmented-button pattern used in InlineChallengeForm (mode + color + rated), ChallengeModal (same 3), and PlayOnline (rated).

  - [ ] Create `apps/web/src/components/ui/ToggleGroup.tsx` — Props: `{ value: T, onChange: (v: T) => void, options: { value: T, label: ReactNode, disabled?: boolean }[], label?: string, ariaLabel?: string, className?: string }`. Renders a horizontal group of buttons with active/inactive styling matching the current segment-button classes (`bg-accent text-white` active, `bg-surface-elevated text-text-secondary hover:text-text-primary` inactive). `aria-pressed` on active option, `role="group"` on container, optional label above. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/components/ui/__tests__/ToggleGroup.test.tsx` — options render; click fires onChange with correct value; active option has aria-pressed=true; label renders when passed. RED-validate. **[Agent: react-frontend]**
  - [ ] Migrate `pages/PlayOnline.tsx` — rated/casual segment → `<ToggleGroup value={isRated} onChange={setIsRated} options={[{value: true, label: 'Рейтинговая'}, {value: false, label: 'Нерейтинговая'}]} label={t('play.online.rated.label')} />`. **[Agent: react-frontend]**
  - [ ] Migrate `features/play/InlineChallengeForm.tsx` — three segments (mode / rated / color) → three `<ToggleGroup>` instances. Delete the `segmentBase/segmentActive/segmentInactive` variables. **[Agent: react-frontend]**
  - [ ] Migrate `features/friends/ChallengeModal.tsx` — three segments (mode / color / rated) → three `<ToggleGroup>` instances. **[Agent: react-frontend]**
  - [ ] Verify: tests + build green; existing component tests still pass. **[Agent: react-frontend]**

---

- [ ] **Slice 4: Extract `EmptyState` + migrate + mode-card consolidation + Verify screenshots**

  > Last extraction slice. EmptyState + shared MODE_OPTIONS/TIME_LABELS constants + before/after visual sanity check.

  - [ ] Create `apps/web/src/components/ui/EmptyState.tsx` — Props: `{ icon?: LucideIcon, title: string, description?: string, actions?: { label: string, onClick: () => void, variant?: 'primary' | 'secondary', to?: string }[], className? }`. Icon centered above, title + description in center column, actions as button row (links if `to` prop set). **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/components/ui/__tests__/EmptyState.test.tsx` — renders title; description when passed; icon when passed; action buttons fire onClick; `to` prop makes buttons links. **[Agent: react-frontend]**
  - [ ] Migrate `features/history/GameHistorySection.tsx` — both empty states (no-games + no-filter-results) → `<EmptyState>`. **[Agent: react-frontend]**
  - [ ] Migrate `features/sidebar-popups/FriendsPopup.tsx` — empty state → `<EmptyState>`. **[Agent: react-frontend]**
  - [ ] Migrate `features/sidebar-popups/NotificationsPopup.tsx` — empty state → `<EmptyState>` (icon-only variant). **[Agent: react-frontend]**
  - [ ] Migrate `features/play/FriendsLobbyPanel.tsx` — no-friends empty state → `<EmptyState>`. **[Agent: react-frontend]**
  - [ ] Grep for other inline "no X yet" + "Find Y" patterns and migrate if found. **[Agent: react-frontend]**
  - [ ] Amend `apps/web/src/features/shared/mode-labels.ts` — export `MODE_OPTIONS: { mode: Mode, Icon: LucideIcon }[]` + ensure `TIME_LABELS` exported. Both `ModeSelector.tsx` + `VsBotSetup.tsx` now import from here instead of inlining. **[Agent: react-frontend]**
  - [ ] Grep for any remaining duplicated patterns (e.g., mode-cards grid structure in VsBotSetup vs ModeSelector) — if any clear duplication left, extract or document in Change Log. **[Agent: react-frontend]**
  - [ ] Visual sanity verify: dev-start web preview on 5173 (dev-API already running), take 5 screenshots on key pages (`/`, `/play`, `/play/friend`, `/profile`, `/friends`) → compare with any prior visual baseline (eyes on). Save to `docs/screenshots/016-after-*.png`. **[Agent: general-purpose]**

---

- [ ] **Slice 5: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [ ] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 016-component-extraction` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [ ] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
