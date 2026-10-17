# Technical Specification: Home Page Games List

- **Functional Specification:** [`./functional-spec.md`](./functional-spec.md)
- **Status:** Draft
- **Author(s):** AWOS /awos:tech (orchestrator-authored from Explore findings; small scope — no specialist delegation needed)

---

## 1. High-Level Technical Approach

Pure additive change. One new frontend component (`RecentGamesSection`) that is a thin wrapper around the already-reusable `GameRow` + `useGamesList` hook, with `limit=10` and no filters / pagination. One new frontend page (`History.tsx`) that is a thin wrapper around the already-complete `<GameHistorySection />`. One new route `/history` added to the authenticated layout block in `routes.tsx`. One tiny backend addition: optional `limit` query param on `GET /users/me/games` (max 50, default stays 20 to preserve current paginated behavior).

Scope touches only: `apps/api/src/modules/game-history/*` (query DTO + service), `apps/web/src/features/history/*` (new RecentGamesSection), `apps/web/src/pages/*` (Home amend + new History page), `apps/web/src/routes.tsx`, i18n locale files.

No Prisma migration, no new npm dependency, no shared-package schema change (the existing `GameListItem` already carries everything we render).

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Backend — optional `limit` query param on `GET /users/me/games`

| File | Change |
|---|---|
| `apps/api/src/modules/game-history/dto/get-game-history-query.dto.ts` | `getGameHistoryQuerySchema` gains `limit: z.coerce.number().int().min(1).max(50).optional()` |
| `apps/api/src/modules/game-history/game-history.service.ts` | `listGames(userId, { page, mode, result, limit })` — when `limit` is set, bypass pagination: `take = limit`, `skip = 0`, pagination object returned as `{ page: 1, pageSize: limit, totalCount, totalPages: 1 }` (or similar — pagination shape stays the same so no DTO change). When `limit` is absent, behavior is unchanged (PER_PAGE = 20). |

Clients can now request e.g. `GET /users/me/games?limit=10` → returns the 10 most-recent games newest-first, no filter. All existing callers (Profile's GameHistorySection) continue to work unchanged — they never pass `limit`.

### 2.2 Frontend file map

| File | Status | Purpose |
|---|---|---|
| `apps/web/src/features/history/useGamesList.ts` | amend | Accept optional `limit?: number` arg. When set, append `&limit=<n>` to the URL and skip the `page/mode/result` query params if the caller passes none (keeps home-side URL clean). Returns the same `{ games, pagination, loading, error, refetch }` shape. |
| `apps/web/src/features/history/RecentGamesSection.tsx` | new | Compact list for Home. Renders header `t('history:recentGames')` + list of `<GameRow>` + `<Button>` "View all games" link to `/history`. Reads via `useGamesList({ limit: 10 })`. Zero-games branch renders `<EmptyState>` (reusing the component from spec 016, same copy / actions as Profile's existing empty state). |
| `apps/web/src/features/history/__tests__/RecentGamesSection.test.tsx` | new | Tests: renders N rows for N≤10 games; renders exactly 10 when N≥10; "View all games" button present when games>0 + hidden when games=0; empty state when games=0; row click navigates to `/history/<gameId>`. |
| `apps/web/src/pages/Home.tsx` | amend | Below `<PlayVsBotBlock />` (around line 55), mount `<RecentGamesSection />` for signed-in users. No changes to the anonymous branch. |
| `apps/web/src/pages/History.tsx` | new | New page component. Renders page heading `t('history:title')` ("Game history") + a drop-in `<GameHistorySection />`. Thin wrapper (~15 LOC). |
| `apps/web/src/pages/__tests__/History.test.tsx` | new | Tests: heading renders in the current locale; `<GameHistorySection />` is mounted. |
| `apps/web/src/routes.tsx` | amend | Add `/history` route (lazy-loaded) INSIDE the `<ProtectedRoute><AuthenticatedLayout>` block, positioned before `/history/:gameId` (specific-before-general for React Router v6 safety — though v6 uses rank-based matching, keep the order for clarity). |
| `apps/web/src/i18n/locales/{en,ru,es}/history.json` | amend | Add two keys: `recentGames` and `viewAllGames`. Translate: EN "Recent games" / "View all games", RU "Недавние партии" / "Все партии", ES "Partidas recientes" / "Ver todas las partidas". |

### 2.3 Route restructure (`apps/web/src/routes.tsx`)

Inside the authenticated layout block (currently lines ~101-136), add:

```tsx
<Route
  path="/history"
  element={
    <Suspense fallback={SUSPENSE_FALLBACK}>
      <History />
    </Suspense>
  }
/>
```

Position: before `/history/:gameId` for readability. React Router v6 handles ranking automatically.

Lazy-import at the top of routes.tsx:
```ts
const History = lazy(() => import("./pages/History").then((m) => ({ default: m.History })));
```

### 2.4 RecentGamesSection component contract

```ts
export function RecentGamesSection(): JSX.Element {
  const { t } = useTranslation("history");
  const { games, loading } = useGamesList({ limit: 10 });

  if (loading) return <SpinnerOrSkeleton />;
  if (games.length === 0) return <EmptyState ...sameAsProfileEmpty... />;

  return (
    <section>
      <h2>{t("recentGames")}</h2>
      <ul>{games.map(g => <GameRow key={g.gameId} item={g} />)}</ul>
      <Link to="/history"><Button>{t("viewAllGames")}</Button></Link>
    </section>
  );
}
```

No props. Self-contained. Reuses `GameRow`, `useGamesList`, `EmptyState`, `Button`, `Link`.

### 2.5 History page contract

```ts
export function History(): JSX.Element {
  const { t } = useTranslation("history");
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      <GameHistorySection />
    </div>
  );
}
```

GameHistorySection already renders filters + list + pagination. No new logic needed — just a page wrapper.

### 2.6 Localization

**New i18n keys** in `history.json`:

| key | en | ru | es |
|---|---|---|---|
| `recentGames` | "Recent games" | "Недавние партии" | "Partidas recientes" |
| `viewAllGames` | "View all games" | "Все партии" | "Ver todas las partidas" |

Existing keys reused:
- `title` ("Game history") — already present
- `emptyTitle`, `emptyBody`, `emptyActions.*` — already present (Profile empty state copy)
- Mode / result / endReason / pagination labels — already present

### 2.7 Testing surfaces

**Backend:**
- Extend existing `apps/api/test/unit/game-history-service.spec.ts` (or add a new one) with 2-3 tests: `limit=10` returns at most 10 games; `limit` is bounded to max 50; omitting `limit` preserves PER_PAGE=20 behavior.
- E2E: existing e2e spec covers the base endpoint; add 1 test calling `?limit=10` and asserting the response count matches.

**Frontend:**
- `RecentGamesSection.test.tsx` — 5-6 tests described in §2.2.
- `History.test.tsx` — 2 tests: heading renders, GameHistorySection mounts.
- Extend `apps/web/src/pages/__tests__/Home.test.tsx` (if exists; else create) — RecentGamesSection appears for signed-in users.

### 2.8 Backward compatibility

- Existing Profile `<GameHistorySection />` call site is **unchanged** — no props, no behavior change.
- Existing `/users/me/games` consumers that don't pass `limit` get the exact same response as today (PER_PAGE=20 paginated).
- Existing `/history/:gameId` replay route is **unchanged** — only `/history` (no id) is new.

---

## 3. Impact and Risk Analysis

### 3.1 System Dependencies

- **No new npm deps.**
- **No shared-package changes.** `GameListItem` already carries every field RecentGamesSection renders.
- **No Prisma migration.** Backend change is query-param only.
- **No infrastructure change.** Fly, Neon, Upstash all unaffected.

### 3.2 Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hitting `?limit=10` creates a performance hotspot on Home | Negligible — Prisma already orders by `startedAt desc` + has indexes on `whiteUserId, startedAt` and `blackUserId, startedAt` (schema confirmed in spec 006). `take 10` is faster than `take 20`. |
| `limit` abuse (client passes `?limit=10000`) | Zod schema enforces `max(50)`. Any value above is rejected with 400. |
| RecentGamesSection flashes "No games yet" during initial fetch | Loading state renders a skeleton or empty space during `loading === true`. If this causes a visible flash, add a simple spinner. |
| Profile and Home both fetch `/users/me/games` on page load | Two independent fetches (page=1 for Profile, limit=10 for Home). Different params → not cacheable at the HTTP layer today. Acceptable: visiting both pages means 2 small queries. If this becomes a measurable issue, add a client-side cache (SWR / React Query) in a future spec. |
| Home becomes slow because of extra section | Measured only after shipping. Expected: one small fetch of 10 rows is negligible (~20KB JSON, <100ms). |
| /history route conflicts with /history/:gameId | React Router v6 matches by specificity, not order. Both can coexist. Confirmed by current `/history/:gameId` behavior. |

---

## 4. Testing Strategy

### 4.1 Backend

- Unit tests on `GameHistoryService.listGames` for the `limit` branch:
  - `limit=10` returns at most 10 games
  - `limit=10` with filter still applies the filter
  - `limit` absent still returns PER_PAGE=20 paginated
- E2E: 1 test — register user, play (seed) 15 games, GET `/users/me/games?limit=10` → response has `games.length === 10`.

### 4.2 Frontend

- `RecentGamesSection.test.tsx` — see §2.2.
- `History.test.tsx` — heading in current locale + mounted section.
- Visual sanity via dev-start + Playwright in Verify slice: open Home signed-in → see "Recent games" section with up to 10 rows + "View all games" button → click → land on /history with full paginated history.

### 4.3 FTR slice

Owned by `testing-expert`. One new web test file + one new api e2e covering the ACs end-to-end.
