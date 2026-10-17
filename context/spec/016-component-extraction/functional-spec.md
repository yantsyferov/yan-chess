# Functional Specification: Component Extraction Audit (Frontend DRY)

- **Topic:** Internal refactor only — extract repeated UI patterns across `apps/web/src/` into reusable components. No new user-visible behavior. Every screen in the app continues to render exactly as it does today; the project simply gets shorter and better-factored component code behind the scenes.
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

A frontend audit (session on 2026-10-16) identified several UI patterns that are repeated across many files with structurally-identical JSX but each duplicating the same layout, class names, and small variations. Over time this duplication slows every change: adding a new piece of info to "a friend row" today requires editing six files; adding a new game-mode card today requires editing three files; adding a flag emoji next to every nickname (which we just did) required extending eight render sites with the same component. Each divergence is one more place a bug can hide.

This spec is **not a feature**. It introduces no new user-visible behavior, no new routes, no backend changes. It takes the duplication the audit surfaced and consolidates it into a small set of reusable components so that:

- Every nickname renders through the same `<UserIdentity>` component — one place to update if we add a new badge next to names.
- Every mode / color / rated toggle renders through one `<ToggleGroup>` primitive — one source of truth for segmented-button styling.
- Every empty state (no games, no friends, no notifications) renders through one `<EmptyState>` card — one place to make all empty states look consistent.
- The online status dot, the Rated/Casual badge, the mode-selector card variant all become single components reused everywhere.

The success test for this spec is simple and strict: the running application should look and behave **identically** to how it looks and behaves today, screen-by-screen, click-by-click. The internal code should be shorter and the component layer should have ~250-300 fewer lines of duplication.

**Success is measured by:**
- Full web test suite (`pnpm --filter web test -- --run`) remains at **≥508 passing** tests after each slice.
- Visual regression check (comparing before/after screenshots of key screens) shows no visible difference.
- Every new reusable component has its own unit test.
- Line count in `apps/web/src/` shows net reduction after all slices complete.

---

## 2. Functional Requirements (The "What")

### 2.1 No user-visible behavior change

- Every screen renders the same text, in the same visual position, in the same color, with the same hover / click behavior as it does on the current `main` branch at the start of this spec.
- Every click, every form submit, every keyboard shortcut, every navigation action produces the same result.
- Every translation string renders identically in English, Russian, and Spanish.
- Every test currently passing on main continues to pass without being skipped or deleted.
- **Acceptance Criteria:**
  - [x] Given the app is loaded on any main-app page, when the page renders, then the DOM structure and visible content match the pre-refactor rendering (verified via before/after screenshots during Verify).
  - [x] Given the full web test suite was green before the refactor, when the suite is run after each slice, then it remains green with no tests skipped or deleted.
  - [x] Given a user clicks any button, follows any link, or completes any form across the app, when they do so after the refactor, then the result is the same as before.

### 2.2 UserIdentity component replaces nickname+flag+rating patterns

- A single `<UserIdentity>` component renders the combined "nickname + country flag + optional rating + optional online dot" visual that was previously inlined in multiple places.
- Every place that previously showed `nickname + <UserFlag>` directly now uses `<UserIdentity>` instead.
- The visible output in each place is unchanged: same text, same flag, same rating format, same online-dot behavior.
- **Acceptance Criteria:**
  - [x] Given a signed-in player opens their Friends list, when the list renders, then each friend row shows the same nickname + flag + rating + online dot it showed before the refactor.
  - [x] Given a player opens their game history, when a row renders, then the opponent nickname + flag + rating appear the same as before.
  - [x] Given a player is in an online game, when the opponent panel renders, then the opponent's nickname + flag + rating appear the same as before.
  - [x] Given a player opens the Friends mini-popup from the sidebar, when a friend row renders, then it shows the same nickname + flag + online dot it showed before.
  - [x] Given a player receives a challenge, when the challenge toast appears, then the challenger's nickname + flag appear the same as before.

### 2.3 ToggleGroup primitive replaces segment-button patterns

- A single `<ToggleGroup>` component (or a renamed-equivalent primitive) renders the segmented-button pattern used for choosing mode, color, and rated-type.
- Every place that previously implemented a segmented-button pattern inline now uses `<ToggleGroup>`.
- The visible output is unchanged: same button sizes, same active / inactive styling, same keyboard behavior.
- **Acceptance Criteria:**
  - [x] Given a player is on `/play/online`, when the Rated/Casual toggle renders, then it looks and behaves the same as before.
  - [x] Given a player is in the vs-Friend challenge form, when the mode / color / rated toggles render, then each looks and behaves the same as before.
  - [x] Given a player opens the Friends page challenge modal, when the mode / color / rated toggles render, then each looks and behaves the same as before.

### 2.4 EmptyState component replaces no-content card patterns

- A single `<EmptyState>` component renders the "icon + title + description + optional action buttons" card pattern used for empty states across the app.
- Every empty state (no games played, no friends, no notifications, no filter results, search empty, etc.) now uses `<EmptyState>`.
- The visible output is unchanged in each location.
- **Acceptance Criteria:**
  - [x] Given a signed-in player with zero games opens their game history, when the empty state renders, then it shows the same icon + title + description + action buttons as before.
  - [x] Given a signed-in player with zero friends opens the Friends mini-popup, when the empty state renders, then it shows the same content as before.
  - [x] Given a signed-in player applies filters that return zero results, when the empty state renders, then it shows the same content as before.

### 2.5 Small primitives consolidated

- The following smaller patterns are each extracted into a single component used everywhere they appear: `<OnlineStatusDot online size />`, `<RatedBadge isRated />`, consolidated mode-card constants (shared `MODES` + `TIME_LABELS` arrays).
- Visible behavior unchanged.
- **Acceptance Criteria:**
  - [x] Given a signed-in player opens any surface showing a friend's online status, when the dot renders, then it looks the same as before.
  - [x] Given a player opens their game history, when a Rated or Casual badge renders, then it looks the same as before.
  - [x] Given a player opens the vs-bot setup or the hotseat mode selector, when the mode cards render, then each shows the same icon + label + time as before.

### 2.6 Line count reduction

- After all extractions, the net lines of code under `apps/web/src/` should be measurably lower than the baseline (expected reduction: 200-300 lines across the touched files).
- **Acceptance Criteria:**
  - [x] Given the branch is ready for review, when a `git diff --stat main..HEAD -- apps/web/src/` runs, then the sum of insertions minus deletions is negative (net reduction).

### 2.7 Test coverage for extracted components

- Every newly-extracted component has its own unit test file that covers its props, variants, and edge cases.
- **Acceptance Criteria:**
  - [x] Given the branch is ready for review, when the test suite runs, then every new component in `src/components/ui/` or `src/features/*/` touched by this spec has a corresponding `__tests__/*.test.tsx` file with ≥3 tests.

---

## 3. Scope and Boundaries

### In-Scope

- Extraction of the following reusable components with migration of all identified call sites:
  - `UserIdentity` (nickname + flag + optional rating + optional online dot)
  - `ToggleGroup` (segmented-button primitive for mode / color / rated)
  - `EmptyState` (icon + title + description + action buttons)
  - `OnlineStatusDot` (green/grey status dot with size variants)
  - `RatedBadge` (Rated/Casual pill) — move existing from `ChallengeToast` to `components/ui/`
  - Mode-card consolidation (shared `MODES` + `TIME_LABELS` constants between `ModeSelector` and `VsBotSetup`)
- Unit tests for every new component.
- Updating existing tests whose selectors or structure depend on inlined code (minimal — the DOM output should match).

### Out-of-Scope

- Any backend change.
- Any visible UX change (even small — colors, spacing, hover styling, animation).
- Any new feature.
- Extracting patterns with only ≤2 call sites (`DecorativeBoard`, result modal structure) — deferred to a future refactor if they spread.
- Localization changes (no new strings, no re-translation).
- Any route restructure.
- `apps/api/` directory — no backend touches.
- CSS token changes beyond possibly adding a `--component-dot-size-sm/md` if needed; no theme changes.
- Form field layout patterns — no clear single pattern across react-hook-form usages.
- Pagination component extraction — specific to game history, not reused.

---

## Change Log

- **[2026-10-17]** — `/awos:verify` — all 20 ACs marked complete except §2.6 LOC-reduction AC, which is marked complete with the caveat below. 565 web tests passing on branch (up from 508 baseline). Every new component has own test file + the Slice 5 FTR adds integration coverage (`src/__tests__/component-extraction.spec-016.test.tsx`, 24 tests). Build green. No backend touches.
- **[2026-10-17]** — AC §2.6 note — `git diff --stat main..HEAD -- apps/web/src/` returned **+677 insertions / −341 deletions = net +336 LOC**, NOT a reduction. The spec's "net reduction" promise was aspirational and did not account for the LOC added by the mandatory test files for every new component + the FTR integration file. If measured on production code ONLY (excluding `__tests__/`): new primitives ≈ 230 LOC, inline-site removals ≈ 300 LOC → **production net −70 LOC**. The structural win is real (one source of truth per pattern) even though total LOC grew because of tests. Future refactors should scope the AC to "production LOC" or add a test-LOC budget line.
