# Technical Specification: Component Extraction Audit (Frontend DRY)

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Completed
- **Author(s):** AWOS /awos:tech (orchestrator)

---

## 1. High-Level Technical Approach

Pure frontend refactor — zero backend, zero shared-package changes, zero new npm deps. Four new components in `apps/web/src/components/ui/` + one in `apps/web/src/features/profile/`. Every call site identified by the audit is migrated to use the new component. Each slice produces no visible change — regression caught by (a) existing component tests still passing, (b) new unit tests for the extracted components, (c) a before/after visual sanity screenshot during Verify.

Pattern: for each extraction, (1) create the component with its own test, (2) migrate call sites one PR-sweep, (3) delete the inlined duplicates, (4) run full suite + build.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 New components

| File | Status | Responsibility |
|---|---|---|
| `apps/web/src/features/profile/UserIdentity.tsx` | new | Nickname + `<UserFlag>` + optional rating + optional `<OnlineStatusDot>`. Props: `{ nickname, country, rating?, online?, size?, className? }` |
| `apps/web/src/components/ui/ToggleGroup.tsx` | new | Segmented-button primitive. Compound component or array-prop API: `<ToggleGroup value onChange options label? />` |
| `apps/web/src/components/ui/EmptyState.tsx` | new | Centered card with icon + title + description + optional action buttons. Props: `{ icon?: LucideIcon, title, description?, actions?: { label, onClick, variant? }[] }` |
| `apps/web/src/components/ui/OnlineStatusDot.tsx` | new | Small circular dot. Props: `{ online: boolean, size?: 'sm' \| 'md', className? }` |
| `apps/web/src/components/ui/RatedBadge.tsx` | new | Move from `features/friends/ChallengeToast.tsx` (currently defined there). Props: `{ isRated: boolean, size?: 'sm' \| 'md' }` |
| `apps/web/src/features/shared/mode-labels.ts` | amend | Add `MODE_OPTIONS` + `TIME_LABELS` constants (currently inlined in `ModeSelector.tsx` + `VsBotSetup.tsx`) |

### 2.2 Call sites to migrate

**UserIdentity (7 sites):**
- `features/history/GameRow.tsx` — opponent column
- `features/friends/FriendCard.tsx` — row title
- `features/friends/SearchResultCard.tsx` — row title
- `features/sidebar-popups/FriendsPopup.tsx` — row title
- `features/play/InlineChallengeForm.tsx` — friend header
- `features/play/FriendsLobbyPanel.tsx` — list rows
- `features/online/OnlineBoard.tsx` — opponent panel
- `pages/Profile.tsx` — identity card heading

**ToggleGroup (3 segment usages, each with 2-3 toggles):**
- `pages/PlayOnline.tsx` — rated/casual
- `features/play/InlineChallengeForm.tsx` — mode + color + rated
- `features/friends/ChallengeModal.tsx` — mode + color + rated

**EmptyState (5 sites):**
- `features/history/GameHistorySection.tsx` — no-filtered-results + no-games
- `features/sidebar-popups/FriendsPopup.tsx` — no friends
- `features/sidebar-popups/NotificationsPopup.tsx` — no notifications
- `features/friends/FriendsSearch.tsx` — no results (if present)
- `features/play/FriendsLobbyPanel.tsx` — no friends

**OnlineStatusDot (5 sites):**
- `features/sidebar-popups/FriendsPopup.tsx`
- `features/friends/FriendCard.tsx`
- `features/online/OnlineBoard.tsx`
- `features/play/InlineChallengeForm.tsx`
- `features/play/FriendsLobbyPanel.tsx`

**RatedBadge (2 sites):**
- `features/history/GameRow.tsx` — inline currently
- `features/friends/ChallengeToast.tsx` — already extracted here; move + delete local copy

**Mode card constants:**
- `components/game/ModeSelector.tsx` + `features/vs-bot/VsBotSetup.tsx` — both import from shared `features/shared/mode-labels.ts`

### 2.3 Visual regression safety net

- Before Slice 1: capture screenshots of key pages (/play, /play/friend, /profile, /friends, /history/<game>) as baseline.
- After Slice 4 (last extraction): capture same screenshots. Compare visually — any divergence is a regression.
- Store under `docs/screenshots/016-before-*.png` + `016-after-*.png`.

### 2.4 Testing

Every new component gets a test file in a sibling `__tests__/` folder:
- `UserIdentity.test.tsx` — renders nickname + flag; shows rating when passed; shows dot when `online` prop; respects size variants.
- `ToggleGroup.test.tsx` — options render; clicking an option fires onChange with its value; active class on currently-selected option; aria-pressed on selected.
- `EmptyState.test.tsx` — renders title; description when passed; icon when passed; action buttons fire their onClick.
- `OnlineStatusDot.test.tsx` — online renders green dot; offline renders grey dot; size prop applies correct class.
- `RatedBadge.test.tsx` — Rated label when isRated=true; Casual label when false; correct styling per state.

Existing tests that currently assert on inlined markup are updated minimally — a test asserting `getByText('bob')` keeps working because `<UserIdentity>` renders the same text. Only tests that query by specific DOM structure may need touch (fewer than 10 expected).

### 2.5 Lines-saved target

| Pattern | Est. lines saved |
|---|---|
| UserIdentity | 56 (8 lines × 7 sites) |
| ToggleGroup | 90-135 (30-45 lines × 3 sites) |
| EmptyState | 24-32 (6-8 lines × 4 sites) |
| OnlineStatusDot | 20-35 (4-7 lines × 5 sites) |
| RatedBadge | 16 (one inline instance to remove + consolidate) |
| Mode constants | 30 (duplicated arrays) |
| **Total** | **~250-300 LOC net reduction** |

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- No backend changes.
- No shared-package changes.
- No new npm dependencies — all components use existing primitives (Card, Button, lucide-react icons, Radix Popover already in bundle).
- No translation changes — new components accept localized strings as props; no new i18n keys.

### 3.2 Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Visual regression in some screen (new component differs by 1-2 pixels from inlined version) | Before/after screenshots during Verify; existing component tests catch DOM-level regression; manual visual check on key pages |
| ToggleGroup API fits two of three usages but not the third | Design the API by looking at all three call sites first (InlineChallengeForm + ChallengeModal + PlayOnline); choose props shape that covers all three before migrating any |
| Test selectors in existing tests break because DOM nesting changed slightly | Expected minimal — the inner text + roles should match. Fix on a per-test basis as encountered. |
| UserIdentity rendering performance in long lists (friend list of 100+) | Each extracted component is small (~15 lines of JSX); React handles trivially. No memoization unless profiling shows need. |
| Mid-refactor state (half-migrated) breaking a page | Each slice is a single contiguous migration of one component at a time; between slices the app is runnable. |

---

## 4. Testing Strategy

### 4.1 Component-level tests

Each new component gets a unit test file with ≥3 tests (see §2.4).

### 4.2 Existing suite stays green

- `pnpm --filter web test -- --run` runs after each slice. Baseline: 508 tests. Target after refactor: ≥508 (expect small growth from new component tests, no shrink).
- `pnpm --filter web build` must stay green after each slice.

### 4.3 Visual regression (Verify slice)

- Before Slice 1: screenshots of `/play`, `/play/friend`, `/profile`, `/friends`, `/history/<game>` — save as `docs/screenshots/016-before-*.png`.
- After Slice 4: same screenshots — save as `016-after-*.png`. Diff visually.
- If divergence found → fix in-place before marking Verify complete.

### 4.4 FTR slice

- `testing-expert` reviews all 7 ACs from functional-spec.md and adds any missing regression coverage.
- Full suite must pass with new count.
