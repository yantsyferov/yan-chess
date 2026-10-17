# Tasks — Spec 017-home-games-list

Vertical slice plan. Each slice ends with a Verify task that drives the slice end-to-end and deletes its own ephemeral artifacts. Final slice is the standing Feature Testing & Regression suite.

Agents available: `react-frontend`, `nestjs-backend`, `testing-expert`, `general-purpose`.

Baseline: 565 web tests + 141 api unit (+1 skip) + 101 api e2e on main.

---

- [x] **Slice 1: Dedicated `/history` page (full-history URL, no home changes yet)**

  > Smallest user-visible increment. Visitors can type `/history` or follow a future "View all games" link and land on a full-paginated history page. Thin wrapper around the already-complete `<GameHistorySection />`. No backend change in this slice.

  - [x] Create `apps/web/src/pages/History.tsx` — exports `History()`. Renders page heading `t('history:title')` + a drop-in `<GameHistorySection />` inside a `max-w-4xl mx-auto px-4 py-10` container. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/routes.tsx` — add `const History = lazy(...)` import. Add `<Route path="/history" element={<Suspense><History /></Suspense>} />` INSIDE the `<ProtectedRoute><AuthenticatedLayout>` block, before the existing `/history/:gameId` route. **[Agent: react-frontend]**
  - [x] Add `apps/web/src/pages/__tests__/History.test.tsx` — 2-3 tests: heading renders via `t('history:title')` ("Game history"); `<GameHistorySection />` mounts (query a known rendered element); route guard — anonymous visit redirects to /login (via MemoryRouter). RED-validate one by temporarily changing the heading key. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run src/pages/__tests__/History.test.tsx` passes; `pnpm --filter web build` succeeds; dev-start web preview on port 5173 (dev-API already running on 3000), navigate to `http://localhost:5173/history` as alice (sign in first), confirm page renders with "Game history" heading + existing paginated list + filters. Stop preview by PID; delete any screenshots/recordings produced. **[Agent: general-purpose]**

---

- [x] **Slice 2: Home `Recent games` section + backend `limit` param + "View all games" wiring**

  > Full feature live. Signed-in Home shows last-10 games; "View all games" routes to the Slice 1 `/history` page. Includes the backend `limit` query param since RecentGamesSection depends on it.

  - [x] Amend `apps/api/src/modules/game-history/dto/get-game-history-query.dto.ts` — add `limit: z.coerce.number().int().min(1).max(50).optional()` to `getGameHistoryQuerySchema`. Rebuild shared if needed (schema is API-local, not shared). **[Agent: nestjs-backend]**
  - [x] Amend `apps/api/src/modules/game-history/game-history.service.ts` — `listGames(userId, { page, mode, result, limit })` now checks for `limit`: when present, use `take = limit, skip = 0`, return pagination object as `{ page: 1, pageSize: limit, totalCount, totalPages: 1 }`. When absent, PER_PAGE=20 behavior unchanged. **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/unit/game-history-limit.spec.ts` — 3 tests: `limit=10` returns at most 10 rows; `limit=51` is rejected by Zod (400); omitting `limit` returns PER_PAGE=20 paginated. RED-validate one. **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/e2e/game-history-limit.e2e.spec.ts` — register alice, seed 15 games (reuse existing seed helper if present, else insert directly), GET `/users/me/games?limit=10` as alice → assert `games.length === 10` + `pagination.pageSize === 10`. **[Agent: nestjs-backend]**
  - [x] Amend `apps/web/src/features/history/useGamesList.ts` — accept optional `limit?: number` arg (object-shaped: `useGamesList({ limit?: number })`). When set, append `&limit=<n>` to the URL + skip page/mode/result params if the caller passes none. Existing callers (GameHistorySection) unaffected. **[Agent: react-frontend]**
  - [x] Add new i18n keys to `apps/web/src/i18n/locales/{en,ru,es}/history.json` — `recentGames` (en: "Recent games" / ru: "Недавние партии" / es: "Partidas recientes") + `viewAllGames` (en: "View all games" / ru: "Все партии" / es: "Ver все партии" → fix to "Ver todas las partidas" for es). **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/history/RecentGamesSection.tsx` — reads `useGamesList({ limit: 10 })`. Renders section with heading `t('history:recentGames')` + list of `<GameRow>` + `<Link to="/history">` with `<Button>` labelled `t('history:viewAllGames')`. Empty-state branch uses `<EmptyState>` with same copy as Profile's existing empty state (reuse `history:emptyTitle`, `history:emptyBody` keys; actions link to `/play` and `/vs-bot`). Hide "View all games" button when games=0. **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/history/__tests__/RecentGamesSection.test.tsx` — tests: renders N rows for N≤10 games (mock useGamesList); renders exactly 10 when games array has 15; "View all games" button present when games>0 + absent when games=0; empty state renders when games=0; heading renders in current locale (test RU). RED-validate one. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/pages/Home.tsx` — in the signed-in branch, mount `<RecentGamesSection />` below `<PlayVsBotBlock />`. Anonymous branch unchanged. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter api test:unit` + `pnpm --filter api test:e2e` + `pnpm --filter web test -- --run` all green; `pnpm --filter web build` + `pnpm --filter api build` green; dev-start preview on 5173, sign in as alice, visit `/` → confirm "Recent games" section renders with up to 10 rows + "View all games" button; click "View all games" → lands on `/history` (Slice 1 page); clicking a row navigates to that game's `/history/<id>` replay. Stop preview by PID; delete ephemeral screenshots. **[Agent: general-purpose]**

---

- [x] **Slice 3: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 017-home-games-list` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
