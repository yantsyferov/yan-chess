# Technical Specification: Play Page Redesign

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Draft
- **Author(s):** AWOS /awos:tech (orchestrator + react-frontend + nestjs-backend specialists)

---

## 1. High-Level Technical Approach

Introduce a nested `/play/<mode>` URL pattern. `/play` becomes a public **mode-selector** page composed of a non-interactive `<Board canInteract={false}>` + four `<ModeCard>` right-side cards (Online / Bot / Friend / Hotseat). The current matchmaking screen moves from `/play` into a new `/play/online` route (protected). The current vs-bot page relocates from `/vs-bot` to `/play/ai` (public), with `/vs-bot` kept as a permanent `<Navigate>` redirect so existing bookmarks never break. A new `/play/friend` protected lobby renders the same decorative board with a `<FriendsLobbyPanel>` on the right that switches between **list view** (one row per friend with "Challenge" button) and **challenge view** (time control + rated toggle + color + Send + Challenge-link stub).

Backend adds a `Game.isRated Boolean @default(true)` column + two parallel Redis matchmaking queues per mode (`mm:queue:{mode}:rated` / `:unrated`) so rated and unrated searchers never pair. `RatingService.applyGameResult()` early-returns on unrated games — rating snapshots become `before = after`, delta is zero. Challenge flow (`sendChallenge`) carries `isRated` through to `createGame`. The "Challenge link" button is a UI stub that shows a "Shareable link coming soon" toast and copies nothing.

Scope: `apps/web/src/pages/*`, `apps/web/src/features/play/*` (new), `apps/web/src/features/{friends,history,matchmaking}/*` (amends), `apps/web/src/routes.tsx`, `apps/api/src/modules/{game,matchmaking,rating,friends}/*`, `apps/api/prisma/schema.prisma`, `packages/shared/src/types/{friends,history}.ts`, i18n locale files.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Shared package changes

Centralize the new flag in types consumed by both apps.

| File | Change |
|---|---|
| `packages/shared/src/types/friends.ts` | `ChallengeSendPayload` + `ChallengeReceivedPayload` gain `isRated: boolean` |
| `packages/shared/src/types/history.ts` | `GameListItem` gains `isRated: boolean` |

### 2.2 Prisma migration

Migration `20261016000000_add_game_is_rated`:

| Change | Shape |
|---|---|
| New column | `Game.isRated Boolean @default(true) @map("is_rated") NOT NULL` |
| Backfill | None — `DEFAULT TRUE` makes all existing rows rated at write time |
| Index | None (not queried for filtering) |

Fly `release_command` applies this on deploy. The column is a non-breaking add from the old code's POV (old API ignores the column, new column has safe default).

### 2.3 Routes restructure (`apps/web/src/routes.tsx`)

| Path | Component | Layout | Public / Protected |
|---|---|---|---|
| `/` | `Home` | AuthenticatedLayout | Protected |
| `/game` | `Game` | — | Public (unchanged) |
| `/play` | `PlayHub` _(new)_ | AppShell only | **Public** (was Protected) |
| `/play/ai` | `VsBot` | AppShell only | **Public** (was Protected under `/vs-bot`) |
| `/vs-bot` | `<Navigate to="/play/ai" replace />` | — | Permanent redirect |
| `/play/online` | `PlayOnline` _(new)_ | AuthenticatedLayout | Protected (holds today's matchmaking content) |
| `/play/friend` | `PlayFriend` _(new)_ | AuthenticatedLayout | Protected |
| `/profile`, `/friends`, `/history/:gameId` | unchanged | AuthenticatedLayout | Protected |

Anonymous click on Online or vs Friend in `PlayHub`: `<ModeCard>` renders as `<Link to="/login">` when `requiresAuth && !isAuthenticated`. **No `returnTo` support** — after sign-in user lands on `/`; one extra click back to `/play` to re-select mode. Accepted gap (risk 3).

### 2.4 Frontend file map

| Path | Status | Purpose |
|---|---|---|
| `apps/web/src/pages/PlayHub.tsx` | new | `/play` mode-selector; decorative Board + 4 cards |
| `apps/web/src/features/play/ModeCard.tsx` | new | Reusable mode card (icon, title, desc, CTA, requiresAuth prop) |
| `apps/web/src/pages/PlayOnline.tsx` | new | Current `Play.tsx` content + `isRated` toggle |
| `apps/web/src/pages/PlayFriend.tsx` | new | `/play/friend` lobby — decorative board + FriendsLobbyPanel |
| `apps/web/src/features/play/FriendsLobbyPanel.tsx` | new | Local state `view: 'list' \| 'challenge'`, `selectedFriend` |
| `apps/web/src/features/play/InlineChallengeForm.tsx` | new | mode + rated + color + Send + Challenge-link stub |
| `apps/web/src/pages/VsBot.tsx` | amend | Mostly unchanged; update any internal navigate refs from `/vs-bot` to `/play/ai` |
| `apps/web/src/pages/Play.tsx` | delete | Content extracted to `PlayOnline.tsx` |
| `apps/web/src/routes.tsx` | amend | Route reorg per §2.3 |
| `apps/web/src/features/friends/ChallengeModal.tsx` | amend | Add rated toggle to the existing /friends-page modal |
| `apps/web/src/features/history/GameRow.tsx` | amend | Render Rated/Casual pill from `game.isRated` |
| `apps/web/src/features/matchmaking/useMatchmakingStore.ts` | amend | Carry `isRated` through `joinQueue` call |
| `apps/web/src/i18n/locales/{en,ru,es}/game.json` | amend | New `play.hub.*`, `play.modeCard.*`, `play.online.rated.*`, `play.friend.*`, `history.ratedBadge`, `history.casualBadge` keys |
| `apps/web/src/pages/__tests__/PlayHub.test.tsx` | new | 4 cards, anon vs auth routing |
| `apps/web/src/pages/__tests__/PlayFriend.test.tsx` | new | List ↔ challenge view switching, sendChallenge payload |
| `apps/web/src/__tests__/routes.014.test.tsx` | new | `/vs-bot` redirect, auth-guard on `/play/online` + `/play/friend` |

### 2.5 Backend file map

| Path | Status | Purpose |
|---|---|---|
| `apps/api/prisma/schema.prisma` | amend | Add `isRated Boolean @default(true)` to Game |
| `apps/api/prisma/migrations/20261016000000_add_game_is_rated/migration.sql` | new | DDL `ALTER TABLE games ADD COLUMN is_rated BOOLEAN NOT NULL DEFAULT TRUE` |
| `apps/api/src/modules/game/game.service.ts` | amend | `createGame` + `endGame` accept + propagate `isRated` |
| `apps/api/src/modules/game/game.repository.ts` | amend | `createCompletedGame` input gains `isRated` |
| `apps/api/src/modules/matchmaking/matchmaking.service.ts` | amend | Two parallel queues per mode; `joinQueue` + `leaveQueue` + pairing worker all read `isRated` |
| `apps/api/src/modules/rating/rating.service.ts` | amend | `applyGameResult` early-returns on `!isRated` |
| `apps/api/src/modules/friends/challenge.service.ts` | amend | `ChallengeRecord` + `sendChallenge` + `resolveAccept` carry `isRated` |
| `apps/api/src/modules/game-history/game-history.service.ts` | amend | Map `game.isRated` into DTO |
| `apps/api/test/unit/matchmaking-rated-segregation.spec.ts` | new | Rated vs unrated enter different queues |
| `apps/api/test/unit/rating-skip-unrated.spec.ts` | new | `applyGameResult` skips when `!isRated` |
| `apps/api/test/e2e/game-rated-flag.e2e.spec.ts` | new | Full matchmaking flow sets `isRated` on persisted Game |
| `apps/api/test/e2e/challenge-rated.e2e.spec.ts` | new | Challenge with `isRated=false` persists correctly, history returns `isRated=false` |

### 2.6 Matchmaking segregation — Redis key families

Two parallel sorted sets per mode:

```
mm:queue:{mode}:rated      e.g. mm:queue:Blitz:rated
mm:queue:{mode}:unrated    e.g. mm:queue:Blitz:unrated
```

The current `mm:queue:{mode}` key is retired. `joinQueue(userId, nickname, mode, isRated)`:

```ts
queueKey = isRated ? `mm:queue:${mode}:rated` : `mm:queue:${mode}:unrated`
```

`mm:entry:{userId}` hash gains field `isRated: "true"/"false"` so `leaveQueue` can derive the correct key without re-querying the client.

Pairing worker iterates **(mode × isRated)** matrix = 8 scans/sec. Each scan reads only its own queue — no cross-pairing possible. When a pair is found, `createGame(whiteId, blackId, mode, isRated)` persists the flag. The `game:{gameId}` Redis hash stores `isRated` for `endGame` to read when deciding whether to invoke `RatingService.applyGameResult`.

### 2.7 Rating skip semantics

`RatingService.applyGameResult(ctx)` where `ctx.isRated: boolean`:
- `isRated === false` → log, return `{ whiteBefore: current, whiteAfter: current, whiteDelta: 0, blackBefore, blackAfter, blackDelta: 0 }`. No `prisma.ratingByMode.update` call.
- `isRated === true` → unchanged ELO K-factor logic.

For unrated games stored in DB: `whiteRatingBefore === whiteRatingAfter` (= current rating at game-creation time), delta is 0.

**Important for UI:** Rated badge on game history must read `isRated` directly — NOT infer from delta. A rated game can have delta = 0 (K-factor rounding, rare but possible), so delta is not a reliable proxy.

### 2.8 Challenge flow changes

- `ChallengeSendPayload` gains `isRated: boolean`.
- `ChallengeService.sendChallenge()` reads `body.isRated`, writes to `challenge:{challengeId}` Redis hash field `isRated: "true"/"false"`.
- `ChallengeService.resolveAccept()` reads `isRated` from the hash (default `true` if missing — safe fallback for in-flight challenges at deploy time), calls `createGame(..., isRated)`.
- `ChallengeReceivedPayload` surfaces `isRated` so the incoming toast UI can label the challenge "Rated" or "Casual".

### 2.9 Non-interactive Board usage

```tsx
<Board
  fen={START_FEN}
  canInteract={false}
  boardOrientation="white"
  onPieceDrop={() => false}
  onSquareClick={() => {}}
  lastMove={null}
  pendingPromotion={null}
  selectedSquare={null}
  onMove={() => {}}
  onSelectSquare={() => {}}
/>
```

`START_FEN` = `new Chess().fen()`, hoisted to module scope.

### 2.10 FriendsLobbyPanel state

Local `useState<{ kind: 'list' } | { kind: 'challenge'; friend: Friend }>`. Friends from `useFriendsStore(s => s.friends)` — already wired via `AuthenticatedLayout`. On "Send challenge" → `useFriendsStore.sendChallenge({ friendId, timeControl, color, isRated })` → success → reset view + toast.

### 2.11 Challenge-link stub

```ts
<Button onClick={() => toast.info(t('play.friend.challengeLinkComingSoon'))}>
  {t('play.friend.challengeLink')}
</Button>
```

No `navigator.clipboard` write.

### 2.12 i18n keys (EN values; RU/ES filled during impl)

Under `game.json`:
- `play.hub.title` — "How do you want to play?"
- `play.modeCard.{online,ai,friend,hotseat}.{title,description}`
- `play.online.rated.{label,rated,casual}`
- `play.friend.{friendsListTitle,emptyState,challengeButton,backToList,sendChallenge,challengeLink,challengeLinkComingSoon}`
- `history.{ratedBadge,casualBadge}`

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Shared package first.** `GameListItem.isRated` + `ChallengeSendPayload.isRated` additions must land before api & web code starts reading the field. Early slice.
- **Prisma migration before API code.** `prisma migrate deploy` runs via Fly release_command on every merge-to-main (post-spec-011). Column defaults `TRUE` keeps old code compatible mid-deploy.
- **No new npm deps.** React, Zustand, Radix, lucide-react, Chess.js — all present.
- **CORS unchanged.**

### 3.2 Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `/vs-bot` test selectors break | Grep `vs-bot` across `apps/web/src/**/__tests__/**` before deleting old route reference; update to `/play/ai` |
| Existing `mm:queue:{mode}` Redis keys at deploy instant | Any mid-search user is dropped; `ENTRY_TTL_SEC = 300` expires their entry; client reconnect rejoins via new queue. One-time blip, acceptable |
| No `returnTo` on login after anon Online/Friend click | User lands on `/` not `/play` after sign-in. One extra click. Documented as accepted gap |
| In-flight challenges in Redis without `isRated` field | `resolveAccept` deserializes with `?? "true"` fallback. No data loss |
| Rating delta = 0 for rated games (K-factor rounding) breaks UI badge logic | GameRow MUST read `isRated` directly, NOT derive from delta. Enforced in `GameRow.tsx` + unit test |
| `GameListItem.isRated` added to shared before api DTO mapper updates | Slice order: shared types first → api DTO mapper → web GameRow render. CI typecheck catches order violations |
| `Game` row addition changes DB schema under active prod traffic | `ADD COLUMN NOT NULL DEFAULT TRUE` is a non-blocking operation on Postgres 16 (fast metadata-only change). Prisma applies via release_command before new machines boot — no mixed-schema window |

---

## 4. Testing Strategy

### 4.1 Frontend (`apps/web/`, Vitest + RTL)

- `PlayHub.test.tsx` — 4 cards present + order; anon Online card `href=/login`, Bot `href=/play/ai`; signed-in Online card `href=/play/online`.
- `PlayFriend.test.tsx` — list view with mocked friends; empty state when 0 friends; Challenge button → challenge view; Send → `sendChallenge` payload includes `isRated`.
- `GameRow.test.tsx` (extend) — Rated badge when `isRated=true`, Casual when `false`.
- `routes.014.test.tsx` — `/vs-bot` redirects to `/play/ai`; `/play/online` without auth → `/login`; `/play/friend` without auth → `/login`; `/play/ai` without auth renders VsBot (no redirect).

Expected delta: 393 → ~410 web tests.

### 4.2 Backend (`apps/api/`, Vitest)

- `matchmaking-rated-segregation.spec.ts` — joinQueue true vs false hit different Redis keys; no cross-pairing.
- `rating-skip-unrated.spec.ts` — `applyGameResult({ isRated: false })` never calls `prisma.ratingByMode.update`, returns zero deltas.
- `game-rated-flag.e2e.spec.ts` — two users join rated Blitz → game persisted with `isRated=true` + ratings updated; repeat unrated → game `isRated=false` + ratings unchanged.
- `challenge-rated.e2e.spec.ts` — sendChallenge `isRated=false` → accept → game persisted with `isRated=false` + history row returns `isRated=false`.

Expected delta: 131 → ~133 api unit; 86 → ~88 api e2e.

### 4.3 Feature Testing & Regression (FTR slice)

Owned by `testing-expert`. Covers each AC in `functional-spec.md` §2.1-§2.8 with `@spec: 014-play-redesign` + `@regression` annotations.

### 4.4 Live smoke (Verify slice, Playwright MCP)

- Anon `/play` → 4 cards visible; click Bot → `/play/ai` setup; click Online → `/login`.
- Signed in `/play` → click vs Friend → `/play/friend` lobby with friend list; click friend → challenge form with rated toggle + Send + Challenge-link; click Challenge-link → "Shareable link coming soon" toast; click Send → challenge sent + list restored.
- `/play/online` with Casual toggle → find game → game ends → rating unchanged + game-history row marked "Casual".
- `/vs-bot` URL → auto-redirect to `/play/ai`.
