# Technical Specification: Friends

- **Functional Specification:** `context/spec/007-friends/functional-spec.md`
- **Status:** Completed
- **Author(s):** AWOS /awos:tech

---

## 1. High-Level Technical Approach

One new Prisma model (`Friendship`), one new NestJS module (`FriendsModule` with REST controller + Socket.IO gateway on a dedicated `/friends` namespace), one new frontend feature folder (`features/friends/`) with a Zustand store and a globally-mounted notification layer, and a Redis-backed challenge-lifecycle sweeper. The feature **reuses** the existing `user:{userId}` socket-room pattern from spec 004 for presence, the `GameService.createGame` + `game.start` emit from spec 004 for the challenge-accept game-start path, and the ELO flow for rating effect.

**No new npm dependencies, no new DB infrastructure.** Additive migration only.

**Affected systems:**
- `apps/api`: new `friends` module + new Friendship Prisma model + one additive migration.
- `apps/web`: new `/friends` route + feature folder + globally-mounted `FriendsNotificationLayer` + Header "Friends" link with pending-count badge.
- `packages/shared`: new DTO types for friends/challenges.
- Spec 004 infrastructure (`GameGateway.user:{userId}` room, `GameService.createGame`, ELO flow) — reused unchanged.
- Spec 006 game-history — unaffected; challenge-created games just show up in the archive like any other online game.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Data Model

New Prisma model + enum (`apps/api/prisma/schema.prisma`):

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid`, pk | — |
| `userAId` | `uuid`, FK → `User` | **canonical ordering**: `userAId < userBId` by UUID string compare → one row per pair regardless of who initiated |
| `userBId` | `uuid`, FK → `User` | FK with `onDelete: Cascade` (if a user is deleted, the row is removed) |
| `status` | enum `FriendshipStatus` (`pending` \| `accepted`) | — |
| `initiatedBy` | `uuid` | which of userA/userB sent the request (needed to know direction while pending) |
| `createdAt` | `timestamptz(3)` | — |
| `respondedAt` | `timestamptz(3)?` | null while pending; set on accept |

Indexes:
- `@@unique([userAId, userBId])` — one row per ordered pair.
- `@@index([userAId, status])` and `@@index([userBId, status])` — fast lookup for "my friends" / "my pending inbound".

Back-relations on `User`: `friendshipsAsA Friendship[] @relation("UserAFriendships")`, `friendshipsAsB Friendship[] @relation("UserBFriendships")`.

**Alternative considered:** separate `FriendRequest` + `Friendship` tables. Rejected — the state machine (pending → accepted, or pending → deleted, or accepted → deleted) is trivial. Decline just deletes the row (no soft-delete; allows re-sending with no cooldown per functional-spec §2.3).

Migration: additive only; `apps/api/prisma/migrations/<ts>_add_friendship/`.

### 2.2 Backend module layout

`apps/api/src/modules/friends/`:

| File | Role |
|---|---|
| `friends.module.ts` | Imports `PrismaModule`; provides `JwtAuthGuard` + `TokenVerifierService` locally (same pattern as `GameHistoryModule`); providers `FriendsController` + `FriendsService` + `FriendsGateway` + `ChallengeExpirySweeper` |
| `friends.controller.ts` | REST endpoints (JWT-guarded) |
| `friends.service.ts` | Prisma queries, presence batching, Redis challenge state, socket emit helpers (service holds a reference to `FriendsGateway` for `server.to(...)` calls) |
| `friends.gateway.ts` | `@WebSocketGateway({ namespace: 'friends', cors: ... })`. Subscribes to `hello`, `challenge.send`, `challenge.respond`, `challenge.cancel`. Reuses `WsJwtGuard` globally |
| `challenge-expiry.sweeper.ts` | `@Interval(1000)` worker — scans Redis `challenge:*` keys, fires `challenge.expired` on expiry |
| `dto/` | Zod schemas for all request bodies and query params |

Register `FriendsModule` in `AppModule`.

### 2.3 REST API

All endpoints `@UseGuards(JwtAuthGuard)`. User id taken from `req.user.sub`.

| Method | Path | Query / Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/friends` | — | `FriendListResponse` | Resolves `online` per friend via `server.in('user:'+friendId).fetchSockets()` — batched in `Promise.all`. Returns Blitz rating from `RatingByMode` where `mode=Blitz` |
| `GET` | `/api/v1/friends/requests` | — | `FriendRequestsResponse` | Lists Friendships where `status=pending` AND the current user is the non-initiator |
| `GET` | `/api/v1/friends/search` | `?q=<term>` | `FriendSearchResponse` | Case-insensitive substring on `nickname_normalized`, cap 20, self excluded. Each result's `relationship` field is `none / pending_outbound / pending_inbound / friend` based on existing Friendship rows |
| `POST` | `/api/v1/friends/requests` | `{ userId: <target> }` | `{ status: "pending" \| "accepted" }` | Checks: not self; no existing accepted row. If reverse-pending exists → flip to `accepted`, set `respondedAt`, emit `friend.accepted` to both. Else insert new pending row + emit `friend.requested` to recipient. 409 on duplicate outbound |
| `POST` | `/api/v1/friends/requests/:friendshipId/accept` | — | `{ ok: true }` | Only the recipient (non-initiator) can accept. Flip to accepted, emit `friend.accepted` to both |
| `POST` | `/api/v1/friends/requests/:friendshipId/decline` | — | `{ ok: true }` | Only the recipient can decline. Delete row. Emit `friend.declined` to initiator only (silent on UI per spec §2.3 but useful for Search-card reconciliation) |
| `DELETE` | `/api/v1/friends/:userId` | — | `{ ok: true }` | Deletes the accepted Friendship. Emit `friend.unfriended` to both |

**Error-body shape** — stay consistent with existing modules (NestJS default). No specific body-shape requirements for this feature.

### 2.4 Socket events — namespace `/friends`

Separate namespace from `/play`. Client opens two sockets, both guarded by `WsJwtGuard`, both join `user:{userId}` via `hello`.

**Server → client** (emitted to `user:{userId}` rooms):

| Event | Payload | When |
|---|---|---|
| `friend.requested` | `{ friendshipId, requesterUserId, requesterNickname }` | Inbound request to recipient |
| `friend.accepted` | `{ friendshipId, friendUserId, friendNickname }` | Both sides on accept |
| `friend.declined` | `{ friendshipId }` | Initiator only |
| `friend.unfriended` | `{ friendUserId }` | Both sides on unfriend |
| `friend.presence` | `{ userId, online: boolean }` | Emitted to all friends of this user when their socket count on `/play` or `/friends` crosses 0↔1. Hooked into existing `handleConnection`/`handleDisconnect` in GameGateway + FriendsGateway |
| `challenge.received` | `{ challengeId, challengerUserId, challengerNickname, mode, color, timeoutAt }` | To target |
| `challenge.cancelled` | `{ challengeId }` | To target when challenger cancels or replaces |
| `challenge.declined` | `{ challengeId }` | To challenger on decline |
| `challenge.expired` | `{ challengeId }` | Both sides when 60s timer fires |

**Client → server:**

| Event | Payload | Handler |
|---|---|---|
| `hello` | `{}` | Join `user:{userId}` room on `/friends` |
| `challenge.send` | `{ targetUserId, mode: Mode, color: "white" \| "black" \| "random" }` | Validate (friend, online, not in game, challenger not in game); cancel any existing outbound; write Redis hash + `user:activeChallenge:{challengerId}`; emit `challenge.received` to target. If target has a pending inbound from me → auto-accept the FIRST challenge (mutual-challenge race) |
| `challenge.respond` | `{ challengeId, accept: boolean }` | Only target may respond. On accept: roll color if random, call `GameService.createGame(whiteId, blackId, mode)`, join both sockets to `game:{gameId}` room, emit `game.start` on `/play` namespace, emit `challenge.cancelled` on `/friends` for cleanup. On decline: emit `challenge.declined` to challenger, delete Redis keys |
| `challenge.cancel` | `{ challengeId }` | Challenger-side cancel. Delete Redis keys, emit `challenge.cancelled` to target |

**Presence hook:** both `GameGateway` and `FriendsGateway` add to their `handleConnection` / `handleDisconnect`:
1. On transition 0→1 for `user:{myId}`, query `prisma.friendship.findMany({ where: { OR: [{ userAId: me, status: accepted }, { userBId: me, status: accepted }] } })` → emit `friend.presence { userId: me, online: true }` to each friend's `user:{friendId}` room on `/friends` namespace.
2. On transition 1→0, same with `online: false`.

Both gateways share this logic — extract into a small `PresenceService` that both inject, OR duplicate the ~10 lines. Prefer a helper service for DRY.

### 2.5 Challenge Redis state

| Key | Type | TTL | Fields |
|---|---|---|---|
| `challenge:{challengeId}` | hash | 65 s | `challengerId`, `targetId`, `mode`, `color`, `createdAt`, `timeoutAt` |
| `user:activeChallenge:{userId}` | string | 65 s | current outbound `challengeId` for this user — used to find and cancel on replacement |

`ChallengeExpirySweeper` with `@Interval(1000)`: `SMEMBERS` is not needed because we can scan `user:activeChallenge:*` with `SCAN` cursor or maintain a `challenge:active` set. For simplicity in MVP, maintain a `challenge:active` set (parallel to `game:active` from spec 004), `SADD` on challenge.send, `SREM` on resolve/cancel/expire. Sweeper iterates members, checks `timeoutAt` vs `Date.now()`, fires `challenge.expired` on expiry.

### 2.6 Frontend — new route + feature folder

Routes (`apps/web/src/routes.tsx`):
- Add `/friends` lazy route under `ProtectedRoute` (plain, no `redirectState`).
- Wrap the authenticated-route subtree with a tiny layout that also renders `<FriendsNotificationLayer />` so toasts and challenge banner show on every protected page.

Page: `apps/web/src/pages/Friends.tsx` — thin. Calls `useFriendsStore.wire()` on mount; reads `?tab=` via `useSearchParams`; renders one of three tabs.

Header patch (`apps/web/src/components/ui/Header.tsx`): add "Friends" link for signed-in users between "vs Bot" and the avatar dropdown. Badge `(N)` when `pendingRequestsCount > 0`.

### 2.7 Frontend — `features/friends/` files

| File | Role |
|---|---|
| `friends-socket.ts` | Singleton `/friends` socket. Mirrors `online/socket.ts`: lazily created, access-token-change detection via `useAuthStore.getState().accessToken`, rebuild on mismatch. Emits `hello` on connect. Exports `getFriendsSocket()`, `disconnectFriendsSocket()`, `resetFriendsSocket()` |
| `useFriendsStore.ts` | Zustand store (see §2.8). Also exports standalone `wireFriendsSocket()` idempotent guard (module-level `_wired` boolean) |
| `FriendsSearch.tsx` | Search tab UI — debounced input (300ms, `useEffect`+`setTimeout`), empty hint, result list |
| `FriendsRequestsTab.tsx` | Inbound requests — list of `<RequestCard>` + empty state |
| `FriendsListTab.tsx` | Friends — list of `<FriendCard>` sorted online-first + empty state with "Find players" button |
| `FriendCard.tsx` | Row with online dot, nickname, Blitz rating, Challenge button, "⋯" overflow with Unfriend |
| `RequestCard.tsx` | Row with nickname, relative time (title=ISO), Accept / Decline |
| `SearchResultCard.tsx` | Row with context-aware action: `Friend` / `Request pending` / `Accept request` / `Add friend` |
| `ChallengeModal.tsx` | Two-phase outbound-challenge modal (idle picker, waiting countdown) |
| `ChallengeToast.tsx` | Inbound-challenge banner with Accept/Decline + 60s countdown |
| `FriendRequestToast.tsx` | Inbound-friend-request toast with "View" button |
| `FriendsNotificationLayer.tsx` | Mounted once in the authenticated layout. Renders a React Portal into `document.body` housing all floating UI. Subscribes to a derived store selector (`requestToasts`, `inboundChallenge`, `outboundChallenge`) so unrelated store changes don't re-render it |
| `useChallenge.ts` | Tiny hook — shared countdown logic driven by `expiresAt - Date.now()` with `setInterval(1000)` |

### 2.8 `useFriendsStore` shape

```ts
interface FriendsState {
  // snapshot
  friends: FriendListItem[];
  pendingInbound: FriendRequestItem[];
  pendingOutbound: Array<{ friendshipId: string; targetUserId: string }>;
  pendingRequestsCount: number;  // derived = pendingInbound.length

  // search
  searchQuery: string;
  searchResults: FriendSearchItem[];
  searchLoading: boolean;

  // outbound challenge
  outboundChallenge: {
    targetUserId: string;
    targetNickname: string;
    mode: Mode;
    color: "white" | "black" | "random";
    sentAt: number;      // 0 while draft
    expiresAt: number;   // 0 while draft
    status?: "declined" | "expired";  // transient 2s close state
  } | null;

  // inbound challenge
  inboundChallenge: {
    challengeId: string;
    challengerUserId: string;
    challengerNickname: string;
    mode: Mode;
    expiresAt: number;
  } | null;

  // ephemeral toasts
  requestToasts: Array<{ id: string; requesterNickname: string; createdAt: number }>;

  // actions
  wire(): Promise<void>;  // idempotent — module-level _wired guard
  search(query: string): Promise<void>;
  sendFriendRequest(targetUserId: string): Promise<void>;
  acceptRequest(friendshipId: string): Promise<void>;
  declineRequest(friendshipId: string): Promise<void>;
  unfriend(friendUserId: string): Promise<void>;

  openChallenge(targetUserId: string, targetNickname: string): void;
  sendChallenge(mode: Mode, color: "white"|"black"|"random"): void;
  cancelOutboundChallenge(): void;
  respondInboundChallenge(accept: boolean): void;

  dismissRequestToast(id: string): void;
}
```

`wire()`:
1. Fetch snapshots in parallel: `apiGet<FriendListResponse>('/friends')`, `apiGet<FriendRequestsResponse>('/friends/requests')`.
2. Populate `friends`, `pendingInbound`.
3. Call `getFriendsSocket()` + attach all server-event listeners.
4. Idempotent via module-level flag — same pattern as `wireMatchmakingSocket` from spec 004.

**Socket event → state transition mapping:** per §2.4 table above. Pending-outbound is maintained client-side on `sendFriendRequest` (optimistic) and reconciled on `friend.accepted` or `friend.declined`.

**Game-start handling:** `useOnlineGameStore` already listens to `game.start` on `/play` and navigates. `useFriendsStore` adds its own listener on `/play` socket (or hooks a one-shot callback) to clear `outboundChallenge` / `inboundChallenge` when the challenge-triggered game lands. Alternative: subscribe to `useOnlineGameStore` state changes via Zustand's `subscribe`, clearing on `gameId !== null`. Pick the second — avoids cross-store socket bleed.

### 2.9 Shared types

New file `packages/shared/src/types/friends.ts`:

- `FriendshipRelationship = "none" | "pending_outbound" | "pending_inbound" | "friend"` (as-const + derived union)
- `FriendListItem`, `FriendListResponse`
- `FriendRequestItem`, `FriendRequestsResponse`
- `FriendSearchItem`, `FriendSearchResponse`
- Socket payload types: `FriendRequestedPayload`, `FriendAcceptedPayload`, `FriendDeclinedPayload`, `FriendUnfriendedPayload`, `FriendPresencePayload`, `ChallengeReceivedPayload`, `ChallengeCancelledPayload`, `ChallengeDeclinedPayload`, `ChallengeExpiredPayload`, `ChallengeSendPayload`, `ChallengeRespondPayload`, `ChallengeCancelPayload`

Re-export from `index.ts`. Rebuild shared package after each schema change (`pnpm --filter @yanchess/shared build`).

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **Spec 001 `User` model** — relied on for FKs and nickname lookup. No changes.
- **Spec 004 Socket infrastructure (`user:{userId}` rooms, `GameService.createGame`, ELO flow)** — reused unchanged. Presence event emission is the one addition (two gateways both emit `friend.presence` on their connection/disconnection events).
- **Spec 004 online game screen** — challenge-accept opens the exact same `game.start` flow; no divergence.
- **Spec 006 Game history** — challenge-created games land in `games` table identically; show up in history naturally.
- **Hotseat (003) and vs-bot (005)** — zero impact.

### 3.2 Potential Risks & Mitigations

- **`friend.presence` fan-out explosion.** If a user has 1000 friends and goes online/offline often, each flip emits 1000 socket messages. Mitigation: this is MVP — most users will have < 50 friends. If verify shows noise, debounce the flip (e.g. 2s hysteresis before emitting). Not a MVP blocker.
- **Presence race across two namespaces.** User disconnects from `/play` but stays on `/friends`. Should they show offline to friends? Decision: `online = (sockets on /play OR /friends > 0)`. Query both namespaces in the presence check. Simpler: single source — count sockets in the `user:{userId}` room, which is joined on BOTH namespaces, so a single `fetchSockets()` call on one namespace sees both as long as the room name is identical ("user:{id}") and the sockets.join is uniform. Verify: Socket.IO rooms are per-namespace. **Important**: `user:{id}` on `/play` and `user:{id}` on `/friends` are two separate rooms. For presence to be truly accurate we need to count sockets in both. Mitigation: use `server.in('user:'+id).fetchSockets()` on `/play` namespace server, then same on `/friends`; sum.
- **Challenge race — simultaneous mutual send.** Covered in spec §2.5: when `challenge.send` finds an existing inbound challenge from target, auto-accept the first. Needs an atomic Redis check-and-act (Lua script or `WATCH/MULTI`). Mitigation: Lua script that checks `user:activeChallenge:{target}` for an existing challenge whose `challengerId === me`, and if so transitions to accept instead of creating a new one.
- **Challenge expiry sweeper misses.** If the sweeper hiccups (e.g. redis blip), a challenge may linger past 60s on the client. Mitigation: client-side 60s timer also stops the UI even if the server-side event is late; store cleanup on `game.start` is idempotent.
- **Nickname search performance.** `ILIKE '%<term>%'` on `nickname_normalized` doesn't use btree index. With 10K+ users this will be slow. Mitigation: add a trigram index (`pg_trgm` extension + `gin_trgm_ops`) in a future spec; MVP-level user counts don't need it. Document as a future optimization.
- **Deleted user cascade.** `onDelete: Cascade` on both FK — if a user is deleted, all their Friendship rows disappear. User deletion is out of scope for MVP (spec 001 §3), so this is a safety net.
- **Challenge button stuck disabled.** If the "in another game" flag doesn't clear when a game ends (e.g. socket disconnect), the Challenge button may stay disabled. Mitigation: Challenge-button `inGame` state is derived from `user:activeGame:{friendId}` Redis key (same source as spec 004 presence), which clears on `endGame`. Spot-check in verify.

---

## 4. Testing Strategy

### 4.1 Backend — Vitest + Supertest

**Unit** (`apps/api/test/unit/`):
- `FriendsService.canonicalPair(userIdA, userIdB)` — tests ordering so (a, b) and (b, a) produce the same pair.
- Mutual-challenge logic — given target has inbound challenge from me, verify auto-accept path.
- Search filtering — self-filter, case-insensitive substring, result cap at 20 (mock Prisma or real with ioredis-mock).

**E2E** (`apps/api/test/e2e/13-friends.spec.ts`):
- Register alice + bob + charlie via existing fixtures.
- `POST /friends/requests { userId: bob }` as alice → `{ status: "pending" }`.
- `GET /friends/requests` as bob → one row from alice.
- `POST /friends/requests/:id/accept` as bob → `{ ok: true }`; `GET /friends` as alice and bob → each sees the other.
- `DELETE /friends/:userId` as alice → both lose each other.
- Alice sends to bob, bob sends to alice (reverse) → auto-accept flow; both are friends immediately.
- Alice declines → row deleted; alice re-sends → new pending row.
- Access control: charlie can't accept alice-bob's request.
- Self-target: `POST /friends/requests { userId: selfId }` → 400.
- Search: alice searches "bob" → returns bob with `relationship: "pending_outbound"` (or whatever appropriate).

**Socket e2e** (new or extend `13-friends.spec.ts`):
- Two socket.io-client sessions. Alice sends challenge to bob (online). Bob receives `challenge.received`. Bob accepts → both get `game.start` on `/play`. `Game` row exists in Postgres.
- Challenge decline → `challenge.declined` to alice.
- Challenge expire → both get `challenge.expired` after 60s. Reduce timeout for the test (e.g. inject a shorter TTL via env or test-only override).
- Mutual send → first wins, second auto-accepts.
- Challenge from alice while bob is in an active game → rejected with explicit error.

### 4.2 Frontend — Vitest + Testing Library

**Unit:**
- `useFriendsStore` with mocked socket + mocked `apiGet/apiPost`:
  - `wire()` idempotency (two calls, one socket, one listener attached).
  - `search` debounce + API call shape.
  - `sendFriendRequest` → optimistic `pendingOutbound` push.
  - `friend.requested` event → `pendingInbound` + toast added.
  - `friend.accepted` → `friends` list grows, pending cleared.
  - `friend.presence` → the one matching friend's `online` flag toggles.
  - `challenge.received` → sets `inboundChallenge`; superseded by newer `challenge.received` (one-at-a-time).
  - `openChallenge` + `sendChallenge` → outbound draft → waiting; `challenge.declined` → 2s close.

**Component:**
- `FriendsSearch` — hint when empty; cards rendered on results; action button correct per relationship.
- `FriendCard` — Challenge button disabled when offline / in game; overflow menu Unfriend opens confirmation dialog.
- `ChallengeModal` idle → waiting → expired/declined states (fake timers).
- `FriendsNotificationLayer` — toast appears when `requestToasts` non-empty, auto-dismiss after 10s.

**Integration:**
- `Friends.tsx` page — tab switching reflected in URL params; tab content changes.

### 4.3 Playwright

Not configured in this project. Per-slice Verify tasks use Playwright MCP for live browser smoke. Full regression stays in Vitest.

### 4.4 Regression check

- All existing 199+ web tests + 35+ api e2e + 32+ api unit remain green.
- Specs 001-006 behavior unaffected (no shared code modified beyond the two gateways' `handleConnection`/`handleDisconnect` presence hook — covered by regression on online-game tests).
