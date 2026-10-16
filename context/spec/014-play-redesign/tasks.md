# Tasks — Spec 014-play-redesign

Vertical slice plan. Each slice ends with a Verify task that drives the slice end-to-end and deletes its own ephemeral artifacts. Final slice is the standing Feature Testing & Regression suite.

Agents: `react-frontend`, `nestjs-backend`, `postgres-redis-data`, `testing-expert`, `general-purpose`.

---

- [x] **Slice 1: Shared types + Prisma migration + GameHistory DTO (foundation)**

  > Lands the `isRated` field everywhere it's consumed, no behavior change. All existing games default rated. Zero visible impact. This slice is prep so later slices only edit app code.

  - [x] Amend `packages/shared/src/types/history.ts` — add `isRated: boolean` to `GameListItem`. Rebuild shared package. **[Agent: nestjs-backend]**
  - [x] Amend `packages/shared/src/types/friends.ts` — add `isRated: boolean` to `ChallengeSendPayload` + `ChallengeReceivedPayload`. Rebuild shared. **[Agent: nestjs-backend]**
  - [x] Create Prisma migration `20261016000000_add_game_is_rated` — add `isRated Boolean @default(true) @map("is_rated")` to `Game` model. Apply via `pnpm --filter api prisma:migrate:dev`. **[Agent: postgres-redis-data]**
  - [x] Apply same migration to test DB: `pnpm --filter api db:migrate:test`. **[Agent: postgres-redis-data]**
  - [x] Amend `apps/api/src/modules/game-history/game-history.service.ts` — map `game.isRated` → `GameListItem.isRated` in the projection. **[Agent: nestjs-backend]**
  - [x] Verify: `pnpm --filter api test:unit` + `pnpm --filter api test:e2e` + `pnpm --filter web build` all green (no regressions from shared type extension). No visible UI change expected. **[Agent: general-purpose]**

---

- [x] **Slice 2: Backend matchmaking rated segregation + rating skip**

  > Two parallel Redis queues per mode, pairing worker iterates (mode × isRated). RatingService early-returns on unrated games. Default behavior unchanged (all queue entries today default `isRated=true`).

  - [x] Amend `apps/api/src/modules/matchmaking/matchmaking.service.ts` — `joinQueue(userId, nickname, mode, isRated)` picks `mm:queue:{mode}:{rated|unrated}` key; writes `isRated` into `mm:entry:{userId}` hash; `leaveQueue` reads it to pick correct key. **[Agent: nestjs-backend]**
  - [x] Amend the pairing worker loop (inside matchmaking.service.ts or sibling file) — iterate 4 modes × 2 rated → 8 scans/sec; `pairOneInMode(mode, isRated)` reads only its own key. **[Agent: nestjs-backend]**
  - [x] Amend `apps/api/src/modules/game/game.service.ts` — `createGame(whiteId, blackId, mode, isRated)` persists the flag into Prisma + into `game:{gameId}` Redis hash. `endGame` reads `isRated` from Redis to pass down. **[Agent: nestjs-backend]**
  - [x] Amend `apps/api/src/modules/game/game.repository.ts` — `createCompletedGame` input accepts `isRated`. **[Agent: nestjs-backend]**
  - [x] Amend `apps/api/src/modules/rating/rating.service.ts` — `applyGameResult(ctx)` early-returns `{ ...zero deltas }` when `!ctx.isRated` (no `prisma.ratingByMode.update`). **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/unit/matchmaking-rated-segregation.spec.ts` — joinQueue true vs false land in different Redis keys. **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/unit/rating-skip-unrated.spec.ts` — applyGameResult on unrated game does not call prisma.ratingByMode.update, returns zero deltas. **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/e2e/game-rated-flag.e2e.spec.ts` — two users join rated Blitz → persisted game has isRated=true + ratings updated; repeat with unrated → isRated=false + ratings unchanged. **[Agent: nestjs-backend]**
  - [x] Verify: `pnpm --filter api test:unit` + `pnpm --filter api test:e2e` pass. All existing tests still green. **[Agent: general-purpose]**

---

- [x] **Slice 3: Challenge flow carries isRated end-to-end**

  > ChallengeSendPayload + ChallengeReceivedPayload carry isRated. ChallengeService stores it in Redis + passes to createGame on accept. Fallback `isRated=true` for in-flight challenges at deploy time.

  - [x] Amend `apps/api/src/modules/friends/challenge.service.ts` — `ChallengeRecord` interface gains `isRated: boolean`; `sendChallenge(body)` reads `body.isRated` + writes `challenge:{challengeId}` hash field `isRated: "true"/"false"`; `resolveAccept` reads with `?? "true"` fallback, calls `createGame(..., isRated)`. **[Agent: nestjs-backend]**
  - [x] Amend `apps/web/src/features/friends/useFriendsStore.ts` — `sendChallenge({ targetUserId, mode, color, isRated })` sends new field over socket. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/friends/ChallengeModal.tsx` — add rated/unrated segmented control (default "Rated"); include `isRated` in `sendChallenge` call; localize new label via `game.json` keys. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/friends/ChallengeToast.tsx` (or wherever incoming challenge renders) — show "Rated" / "Casual" badge from `ChallengeReceivedPayload.isRated`. **[Agent: react-frontend]**
  - [x] Add `apps/api/test/e2e/challenge-rated.e2e.spec.ts` — sendChallenge isRated=false → accept → game isRated=false + history row isRated=false. **[Agent: nestjs-backend]**
  - [x] Verify: `pnpm --filter api test:e2e` + `pnpm --filter web test -- --run` green. Dev-start, from /friends page send a casual challenge to a friend → confirm friend sees "Casual" badge in incoming toast. Stop services, delete ephemeral artifacts. **[Agent: general-purpose]**

---

- [x] **Slice 4: Game history Rated/Casual badge**

  > `GameRow.tsx` displays Rated/Casual pill from `game.isRated`. New localization keys `history.ratedBadge` + `history.casualBadge`.

  - [x] Amend `apps/web/src/i18n/locales/{en,ru,es}/game.json` — add `history.ratedBadge` ("Rated"/"Рейтинговая"/"Clasificatoria"), `history.casualBadge` ("Casual"/"Нерейтинговая"/"Amistosa"). **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/history/GameRow.tsx` — read `game.isRated` from `GameListItem`, render pill next to mode badge (accent color for rated, muted for casual). **[Agent: react-frontend]**
  - [x] Extend `apps/web/src/features/history/__tests__/GameRow.test.tsx` — Rated badge visible when isRated=true; Casual visible when false; mutual exclusion. RED validate by removing the badge render. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run src/features/history/` passes; dev-start, sign in as alice, play a Casual game vs matchmaking, finish, check history on /profile — row has Casual badge. Stop services. **[Agent: general-purpose]**

---

- [x] **Slice 5: Route restructure — /play/ai + /play/online + /vs-bot redirect**

  > Move current `/play` content → `/play/online` (protected). Move current `/vs-bot` → `/play/ai` (public, drops auth gate). Add `/vs-bot` permanent redirect. `/play` still shows old matchmaking screen in this slice (will be replaced in slice 6).

  - [x] Create `apps/web/src/pages/PlayOnline.tsx` by extracting content from `apps/web/src/pages/Play.tsx`. Add local `const [isRated, setIsRated] = useState(true)` state + two-button segmented control (localized via `play.online.rated.*` keys) + pass `isRated` into `useMatchmakingStore.joinQueue(...)`. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/matchmaking/useMatchmakingStore.ts` — `joinQueue(mode, isRated)` sends new flag over socket. **[Agent: react-frontend]**
  - [x] Add `play.online.rated.{label,rated,casual}` keys to `apps/web/src/i18n/locales/{en,ru,es}/game.json`. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/routes.tsx` — add `/play/online` route (protected, mounts `PlayOnline`); add `/play/ai` route (PUBLIC, mounts `VsBot`); add `/vs-bot` route rendering `<Navigate to="/play/ai" replace />`. Keep `/play` temporarily pointing at `PlayOnline` for continuity until slice 6 replaces it. **[Agent: react-frontend]**
  - [x] Delete `apps/web/src/pages/Play.tsx` (content now in PlayOnline.tsx). **[Agent: react-frontend]**
  - [x] Grep `apps/web/src/**/__tests__/**` for `/vs-bot` string literals and update to `/play/ai`. **[Agent: react-frontend]**
  - [x] Add `apps/web/src/__tests__/routes.014-redirect.test.tsx` — `MemoryRouter initialEntries={['/vs-bot']}` → page shows VsBot content (redirect worked); `initialEntries={['/play/online']}` without auth → redirects to /login; `initialEntries={['/play/ai']}` without auth → renders VsBot (no redirect). **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run` passes; dev-start, open http://localhost:5173/vs-bot — should redirect to /play/ai; open /play/ai without login — bot setup visible; open /play/online without login — redirect to /login. Stop services, delete ephemeral artifacts. **[Agent: general-purpose]**

---

- [x] **Slice 6: /play becomes the mode-selector hub (PlayHub)**

  > Decorative board + 4 mode cards replace the old matchmaking screen at /play. Anonymous click on Online + vs Friend → /login. Bot + Hotseat work directly.

  - [x] Create `apps/web/src/features/play/ModeCard.tsx` — props `{ icon: LucideIcon, titleKey, descriptionKey, ctaKey, to, requiresAuth, isAuthenticated }`. When `requiresAuth && !isAuthenticated` the card renders `<Link to="/login">`, else `<Link to={to}>`. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/pages/PlayHub.tsx` — layout: `flex md:flex-row flex-col gap-6`. Left: `<Board fen={START_FEN} canInteract={false} {...stubs} />` (fixed `md:w-[400px]`). Right: 4 `<ModeCard>` in order Online / vs Bot / vs Friend / Hotseat (lucide icons `Globe`/`Bot`/`Users`/`Monitor`). Reads `useAuthStore(s => s.user)` for `isAuthenticated`. **[Agent: react-frontend]**
  - [x] Add `play.hub.title` + `play.modeCard.{online,ai,friend,hotseat}.{title,description}` keys to `apps/web/src/i18n/locales/{en,ru,es}/game.json`. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/routes.tsx` — `/play` route now **public** (outside `<AuthenticatedLayout>`), mounts `PlayHub`. Keep `/play/online` as the protected matchmaking route from slice 5. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/pages/__tests__/PlayHub.test.tsx` — 4 cards in order; anon user: Online href=/login + Bot href=/play/ai + Friend href=/login + Hotseat href=/game; signed-in: Online href=/play/online + Friend href=/play/friend. RED-validate one card by swapping its `to` href. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run src/pages/__tests__/PlayHub.test.tsx` passes; `pnpm --filter web build` green; dev-start, open /play as anonymous → see 4 cards + decorative board; click Bot card → /play/ai; click Online card → /login; sign in as alice, revisit /play → still 4 cards; click Online → /play/online. Screenshot `docs/screenshots/014-play-hub-anon.png` + `014-play-hub-signed-in.png`. Stop services. **[Agent: general-purpose]**

---

- [x] **Slice 7: /play/friend lobby — FriendsLobbyPanel + InlineChallengeForm**

  > The dedicated vs-Friend lobby. Decorative board + friends panel on the right that switches between list view (one row per friend with Challenge button) and challenge form (mode + rated + color + Send + Challenge-link stub).

  - [x] Create `apps/web/src/features/play/InlineChallengeForm.tsx` — props `{ friend, onSent, onBack }`. Local state for mode (default Blitz), isRated (default true), color (default Random). Renders mode selector + rated toggle + color selector + "Send challenge" + "Challenge link" + "Back to friends list". On Send: calls `useFriendsStore.sendChallenge({ targetUserId: friend.id, mode, color, isRated })` → on success calls `onSent()`. On Challenge link: `toast.info(t('play.friend.challengeLinkComingSoon'))`. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/play/FriendsLobbyPanel.tsx` — local state `view: 'list' | 'challenge'`, `selectedFriend: Friend | null`. Reads `useFriendsStore(s => s.friends)`. List view: for each friend, row with avatar + nickname + online indicator + "Challenge" button. Empty state when 0 friends with link to `/friends`. Challenge view: renders `<InlineChallengeForm friend={selectedFriend} onSent={backToList} onBack={backToList} />`. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/pages/PlayFriend.tsx` — layout mirrors PlayHub: decorative Board left, `<FriendsLobbyPanel />` right. Protected route. **[Agent: react-frontend]**
  - [ ] Add `play.friend.{friendsListTitle,emptyState,challengeButton,backToList,sendChallenge,challengeLink,challengeLinkComingSoon}` keys to `apps/web/src/i18n/locales/{en,ru,es}/game.json`. **[Agent: react-frontend]**
  - [ ] Amend `apps/web/src/routes.tsx` — add `/play/friend` protected route mounting `PlayFriend`. **[Agent: react-frontend]**
  - [ ] Add `apps/web/src/pages/__tests__/PlayFriend.test.tsx` — list view renders with mocked `useFriendsStore.friends`; empty state when friends=[]; click Challenge button → challenge view with form; filling form and clicking Send → `useFriendsStore.sendChallenge` called with `{ targetUserId, mode, color, isRated }`; clicking Challenge link → `toast.info` called with correct i18n key; Back button → returns to list. RED-validate the Send-payload test. **[Agent: react-frontend]**
  - [ ] Verify: `pnpm --filter web test -- --run src/pages/__tests__/PlayFriend.test.tsx` passes; dev-start, sign in as alice, open /play → click vs Friend card → /play/friend lobby → bob visible in list → click Challenge → form appears → tick Casual → click Send → bob (in separate browser) sees "Casual" challenge toast. Screenshot `docs/screenshots/014-play-friend-list.png` + `014-play-friend-challenge-form.png`. Stop services. **[Agent: general-purpose]**

---

- [x] **Slice 8: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 014-play-redesign` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
