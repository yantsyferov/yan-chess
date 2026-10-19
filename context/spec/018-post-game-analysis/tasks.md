# Tasks — Spec 018-post-game-analysis

Vertical slice plan. Each slice ends with a Verify task that drives the slice end-to-end and deletes its own ephemeral artifacts. Final slice is the standing Feature Testing & Regression suite.

Agents available: `chess-engine-specialist`, `nestjs-backend`, `react-frontend`, `postgres-redis-data`, `testing-expert`, `general-purpose`.

Baseline (post merge of #14): 578 web tests + 144 api unit (+1 skip) + 102 api e2e on main.

---

- [x] **Slice 1: `/analysis/:gameId` route + "🔍 Analyze" link in game history (no engine yet)**

  > Smallest user-visible increment. Signed-in player can click "🔍 Analyze" on any row in `/history` (or in Home's "Recent games"), land on a new page that shows the game's board + move list in replay mode. No engine, no eval bar, no tiles. Validates routing + layout + handoff from history.

  - [x] Create `apps/web/src/pages/Analysis.tsx` — thin page: reads `:gameId` from URL, renders a placeholder `<AnalysisPagePlaceholder gameId={id}>` component. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/AnalysisPagePlaceholder.tsx` — reuses `useGameReplay(gameId)` from spec 006 to fetch the game, mounts the existing `ReplayBoard` + `ReplayControls`, renders page heading "Analysis — <opponent nickname>". No engine wiring. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/routes.tsx` — add `const Analysis = lazy(...)` import + `<Route path="/analysis/:gameId" element={<Suspense...><Analysis /></Suspense>} />` INSIDE the `<ProtectedRoute><AuthenticatedLayout>` block. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/history/GameRow.tsx` — add a sibling `<Link to={\`/analysis/${item.gameId}\`}>{t("analyze.link")}</Link>` next to the existing Replay link. Stop click propagation (so the row's own replay link isn't triggered). **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/i18n/locales/{en,ru,es}/history.json` — add `analyze.link` key. EN "🔍 Analyze" / RU "🔍 Анализ" / ES "🔍 Analizar". **[Agent: react-frontend]**
  - [x] Add `apps/web/src/pages/__tests__/Analysis.test.tsx` — 3 tests: (1) page renders heading when `:gameId` resolves, (2) renders `<ReplayBoard>` (query by board role or testid), (3) anonymous visit to `/analysis/<id>` redirects to `/login`. RED-validate one by temporarily removing the heading. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run src/pages/__tests__/Analysis.test.tsx` + full `pnpm --filter web test -- --run` passes; `pnpm --filter web build` succeeds; dev-start web preview on 5173, sign in as alice, open `/history`, click "🔍 Analyze" on a row → confirm `/analysis/<id>` loads with board + move list visible. Stop preview by PID; delete any screenshots. **[Agent: general-purpose]**

---

- [x] **Slice 2: Fast-pass engine + three tiles in `OnlineResultModal`**

  > When an online game ends, the result modal now runs a shallow engine pass in a WebWorker and shows three count tiles (Standout / Normal / Mistake) + an "Analyze" button. Analyze button navigates to the Slice 1 placeholder page (deep pass comes later). Includes the shared `<MoveQualityTiles>` + `<AnalyzeButton>` components used by all three modals in later slices.

  - [x] Create `apps/web/src/features/analysis/opening-book.ts` — build-time build a `Set<string>` from the `chess-openings` npm package (install via `pnpm --filter web add chess-openings`), keyed by UCI move-list prefixes up to 10 half-moves. Export `isBookMove(movesSoFar: string[]): boolean`. **[Agent: chess-engine-specialist]**
  - [x] Create `apps/web/src/features/analysis/classifier.ts` — pure classification function `classifyMove(context): MoveCategory`. Context includes: `legalMoveCount`, `isBookMove`, `topMoves` array (eval + mate), `evalBefore`, `evalAfter`, `playedUci`, `materialDelta`, `prevOpponentWasBlunder`. Precedence per tech-plan §2.3. Export `CLASSIFIER_VERSION = 1`. **[Agent: chess-engine-specialist]**
  - [x] Create `apps/web/src/features/analysis/analysis-engine.ts` — WebWorker wrapper around `/stockfish-19-lite-single.js` (do NOT touch `vs-bot/stockfish-engine.ts`). Exports `analyzeGame({ positions, multiPV, depth, onProgress, signal }): Promise<HalfMoveAnalysis[]>` + `terminate()`. Multi-PV via `setoption name MultiPV value <N>`; cancellation via UCI `stop` on `AbortSignal.abort()`. **[Agent: chess-engine-specialist]**
  - [x] Add `apps/web/src/features/analysis/__tests__/classifier.test.ts` — table-driven: synthetic eval+material inputs → expected MoveCategory. Cover all 11 categories + precedence edge cases (Forced beats Blunder when legalMoveCount=1; Book first ~10 moves). RED-validate one by swapping a threshold. **[Agent: chess-engine-specialist]**
  - [x] Add `apps/web/src/features/analysis/__tests__/opening-book.test.ts` — known opening (1.e4 e5 2.Nf3 Nc6 3.Bb5) → true; obviously-not-book (1.a3 a6 2.b3 b6) after move 3 → false. **[Agent: chess-engine-specialist]**
  - [x] Create `apps/web/src/features/analysis/useFastAnalysis.ts` — hook: accepts `pgn: string`, spawns the engine, runs fast pass (depth 10, MultiPV 2), returns `{ status: 'idle'|'running'|'done'|'error', buckets: { standout, normal, mistake } | null, perSide?: { white: {...}, black: {...} } }`. Cleans up worker on unmount. Pass `perSide: true` option for hotseat. **[Agent: chess-engine-specialist]**
  - [x] Create `apps/web/src/features/analysis/MoveQualityTiles.tsx` — presentational component: props `{ status, buckets, perSide? }`. Loading state: spinner + "Analyzing…". Done: three colored tiles with counts. Error: "Analysis not available." Hotseat: two stacked rows (White:/Black:). **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/AnalyzeButton.tsx` — presentational: props `{ gameRef: { kind: 'online', gameId } | { kind: 'session', source: 'vs-bot'|'hotseat', pgn, playerColor } }`. Online → navigate to `/analysis/<gameId>`. Session → populates `useSessionAnalysisStore` (stub in this slice; next slice uses it) + navigate `/analysis/session`. **[Agent: react-frontend]**
  - [x] Add `apps/web/src/i18n/locales/{en,ru,es}/analysis.json` — all keys from tech-plan §2.4. Full EN translation; RU + ES translations can mirror EN strings for now (Slice 5 polishes). **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/online/OnlineResultModal.tsx` — accept new prop `gameId: string`. Insert `<MoveQualityTiles>` + `<AnalyzeButton gameRef={{ kind: 'online', gameId }}>` above the action-button row. Pass `gameId` from the parent (`OnlineBoard` or wherever the modal is rendered). **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/analysis/__tests__/MoveQualityTiles.test.tsx` + `AnalyzeButton.test.tsx` + `useFastAnalysis.test.tsx` (mock worker) — assert state transitions, correct tile counts rendered, button navigates to correct URL. RED-validate one. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run` passes; `pnpm --filter web build` green; dev-start preview on 5173, sign in as alice, start + finish an online game vs bob (two incognito tabs or paired sign-in), confirm "Your moves" tiles populate within ~10 seconds; click "Analyze" → lands on `/analysis/<gameId>` (still placeholder). Stop preview, delete screenshots. **[Agent: general-purpose]**

---

- [x] **Slice 3: Deep pass + persistence + full `/analysis/:gameId` UI**

  > Signed-in player opens `/analysis/<gameId>` → sees "Analyzing… X/N" progress; when deep pass completes, UI switches to eval bar + board with best-move arrow + annotated move list with 11-category glyphs + "Engine suggests: <SAN>". Results persisted in DB; second participant opens → sees cached result in ~1s. Full-wait UX: no partial UI shown.

  - [x] Add Prisma migration `apps/api/prisma/migrations/<timestamp>_add_game_analysis/migration.sql` + update `schema.prisma`: tables `GameAnalysis` + `GameAnalysisMove` + enum `MoveCategory` (11 values) per tech-plan §2.1. Unique `(gameId)` on `GameAnalysis`; unique composite `(analysisId, moveIndex)` on `GameAnalysisMove`. Run `pnpm --filter api prisma:migrate:dev` to generate the migration + apply locally. **[Agent: postgres-redis-data]**
  - [x] Create `packages/shared/src/types/analysis.ts` + `packages/shared/src/schemas/analysis.ts` per tech-plan §2.2: `MOVE_CATEGORIES` tuple + `MoveCategory` union + `AnalysisMove`, `AnalysisResponse`, `WriteAnalysisMoveBody`, `FinalizeAnalysisBody` + matching Zod schemas. Export via `packages/shared/src/index.ts`. **[Agent: nestjs-backend]**
  - [x] Create `apps/api/src/modules/game-analysis/game-analysis.module.ts` + `game-analysis.service.ts` + `game-analysis.controller.ts` + `dto/write-analysis-move.dto.ts` + `dto/finalize-analysis.dto.ts`. Three endpoints per tech-plan §2.2 (`GET /games/:gameId/analysis`, `PUT /games/:gameId/analysis/moves/:index`, `POST /games/:gameId/analysis/finalize`). Participant check reproduces `GameHistoryService` pattern. Error codes `GAME_NOT_AVAILABLE` + `ANALYSIS_NOT_FOUND`. **[Agent: nestjs-backend]**
  - [x] Register `GameAnalysisModule` in `apps/api/src/app.module.ts`. Rebuild shared via `pnpm --filter shared build`. **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/unit/game-analysis-service.spec.ts` — 5 tests: participant 200; stranger 403; non-existent game 404; upsertMove idempotent (same index twice → single row); finalize stamps `completedAt`. RED-validate one. **[Agent: nestjs-backend]**
  - [x] Add `apps/api/test/e2e/game-analysis.e2e.spec.ts` — register alice+bob, direct Prisma insert of a `Game` row (reuse `game-rated-flag.e2e.spec.ts` pattern), alice PUTs 5 move analyses + POSTs finalize, bob GETs → sees 5 moves in order; charlie GETs → 403. **[Agent: nestjs-backend]**
  - [x] Create `apps/web/src/features/analysis/analysisService.ts` — thin wrappers: `fetchAnalysis(gameId): Promise<AnalysisResponse | null>` (null on 404), `writeMove(gameId, index, body): Promise<void>`, `finalize(gameId, body): Promise<void>`. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/useAnalysisStore.ts` — Zustand store per tech-plan §2.4: session-only Map keyed by gameId/"session", state machine idle→fetching-cache→(cached|running-deep)→done|error|cancelled. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/useDeepAnalysis.ts` — hook: accepts `{ pgn, gameId?, onProgress, onComplete, onError }`. Spawns engine (depth 18, MultiPV 3); streams `onProgress` after each half-move; writes to backend via `analysisService.writeMove` for online games (batched every 5 moves per tech-plan §2.1 §5); calls `finalize` when done. Cancellation via `AbortController`. **[Agent: chess-engine-specialist]**
  - [x] Create `apps/web/src/features/analysis/EvalBar.tsx` — vertical bar with `whitePercent = 50 + 50 * Math.tanh(evalCp / 400)`; mate renders `M<n>` + fills to winning side. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/AnalysisBoard.tsx` — `react-chessboard` wrapper with `customArrows={[[from, to, color]]}` derived from `bestMoveUci`. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/MoveListAnnotated.tsx` — SAN list; per-move glyph (!! / ! / ★ / nothing / ⁉ / ❓ / ⁇ / × / nothing / nothing / nothing) + tooltip (localized category name); click-to-jump; highlights current index. **[Agent: react-frontend]**
  - [x] Create `apps/web/src/features/analysis/AnalysisProgressView.tsx` — centered loading state: "Analyzing… X / N moves" + reassurance line + "Cancel" button that aborts engine + navigates back. **[Agent: react-frontend]**
  - [x] Rewrite `apps/web/src/features/analysis/AnalysisPagePlaceholder.tsx` → `AnalysisPage.tsx`: on mount, `fetchAnalysis(gameId)` → if `completed_at` set + `classifierVersion === CLASSIFIER_VERSION` show cached UI; else spawn `useDeepAnalysis` + render `AnalysisProgressView` until complete; then render full UI (EvalBar + AnalysisBoard + MoveListAnnotated + ReplayControls + "Engine suggests" line). **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/analysis/__tests__/EvalBar.test.tsx` + `AnalysisBoard.test.tsx` + `MoveListAnnotated.test.tsx` + `useAnalysisStore.test.ts` — unit coverage. RED-validate one. **[Agent: react-frontend]**
  - [x] Add `apps/api/test/e2e/game-analysis-classifier-version.e2e.spec.ts` — write analysis with `classifierVersion=0`, GET returns it; next GET with client-side `CLASSIFIER_VERSION=1` → client treats as miss (verified via assertion of returned version). **[Agent: nestjs-backend]**
  - [x] Verify: run `pnpm --filter api test:unit` + `pnpm --filter api build` + `pnpm --filter web test -- --run` + `pnpm --filter web build` — all green. DO NOT run `test:e2e` here (kills dev-API). Dev-start preview on 5173, play an online game to completion, click "Analyze" from result modal → see "Analyzing… X/N" progress → wait ~60s → see full UI (eval bar + board + arrow + markers); close + reopen `/analysis/<gameId>` → cached result in <1s. Stop preview; delete screenshots. **[Agent: general-purpose]**

---

- [x] **Slice 4: Session games — vs-bot + hotseat support (`/analysis/session`)**

  > Signed-in player finishes a vs-bot or hotseat game → result modal shows tiles (fast pass) + Analyze button. Clicking Analyze populates `useSessionAnalysisStore` + navigates to `/analysis/session` which runs deep pass in-tab (no persistence). F5 → "no longer available" notice.

  - [x] Create `apps/web/src/features/analysis/useSessionAnalysisStore.ts` — in-memory Zustand store holding `{ pgn, playerColor, source: 'vs-bot'|'hotseat' } | null`. Setter + clearer. No persistence. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/features/vs-bot/VsBotResultModal.tsx` — insert `<MoveQualityTiles>` (fast pass on game pgn + player color) + `<AnalyzeButton gameRef={{ kind: 'session', source: 'vs-bot', pgn, playerColor }}>`. Note: this modal uses hardcoded English today; wrap new strings in `useTranslation("analysis")` without migrating existing hardcoded strings (deferred per tech-plan §2.5). **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/components/game/ResultModal.tsx` (hotseat) — same insertion but `perSide` tiles (two rows: White + Black) + `source: 'hotseat'` in the button's gameRef. **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/routes.tsx` — add `<Route path="/analysis/session" element={<Suspense...><Analysis /></Suspense>} />` next to `/analysis/:gameId`. Both routes inside ProtectedRoute (document that guest-vs-bot sees sign-in redirect — accepted trade-off per tech-plan §2.4). **[Agent: react-frontend]**
  - [x] Amend `apps/web/src/pages/Analysis.tsx` — when path is `/analysis/session`, read from `useSessionAnalysisStore`. If null → render "no longer available" notice with link back to `/vs-bot` or `/game` (based on `source`). Else → render `AnalysisPage` using session data (no backend fetch, no backend persistence — pure in-tab deep pass). **[Agent: react-frontend]**
  - [x] Amend `useDeepAnalysis` to skip backend persistence when `gameId` is undefined/omitted (session mode). **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/analysis/__tests__/useSessionAnalysisStore.test.ts` + extend `Analysis.test.tsx` with session cases: populated store → deep pass runs; null store → "no longer available" notice renders. RED-validate one. **[Agent: react-frontend]**
  - [x] Verify: dev-start preview, play a quick vs-bot game to completion, click Analyze → tiles populate + deep pass runs on `/analysis/session`; press F5 → "no longer available" notice renders. Repeat for hotseat (`/game`). Stop preview; delete screenshots. **[Agent: general-purpose]**

---

- [x] **Slice 5: Localization polish for RU + ES**

  > All EN strings added in Slices 2-4 get proper RU + ES translations (not mirror-of-EN). Ensures the feature ships at parity across all three product languages per fspec §2.7.

  - [x] Review `apps/web/src/i18n/locales/{ru,es}/analysis.json` — translate all keys to idiomatic Russian + Spanish (tile labels, category names, status messages, buttons). Reuse existing translation terminology from `game.json` / `history.json` where applicable (e.g. SAN labels, Rated/Casual pattern). **[Agent: react-frontend]**
  - [x] Review `apps/web/src/i18n/locales/{ru,es}/history.json` — confirm `analyze.link` key is translated ("🔍 Анализ" / "🔍 Analizar"). **[Agent: react-frontend]**
  - [x] Add `apps/web/src/features/analysis/__tests__/analysis-i18n.test.tsx` — mount `<MoveQualityTiles>` with i18n lang="ru" + "es" and assert tile labels + status strings render in that language. RED-validate one. **[Agent: react-frontend]**
  - [x] Verify: `pnpm --filter web test -- --run` green; dev-start preview, switch locale to RU in sidebar, open `/analysis/<id>` and the result modal — confirm all new strings render in Russian; repeat for ES. Stop preview; delete screenshots. **[Agent: general-purpose]**

---

- [x] **Slice 6: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [x] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 018-post-game-analysis` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [x] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
