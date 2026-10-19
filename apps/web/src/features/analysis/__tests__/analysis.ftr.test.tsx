// @layer: integration
// @spec: 018-post-game-analysis
// @regression — covers end-to-end analysis flow across all layers

/**
 * Feature Testing & Regression — Spec 018 Post-game Analysis
 *
 * Five acceptance-level tests verifying cross-component / cross-layer flows.
 * Each test maps to a specific functional-spec §2.x acceptance criterion.
 *
 * Baseline: 641 web tests.  These add at least 5 → expected total: ≥ 646.
 *
 * Layer rationale:
 *   - Tests 1 & 2  (@layer integration): OnlineResultModal + MoveQualityTiles +
 *     AnalyzeButton rendered together; useFastAnalysis state is injected.
 *   - Test 3        (@layer unit):  MoveListAnnotated with all 11 categories.
 *   - Test 4        (@layer integration): GameRow link in history.
 *   - Test 5        (@layer integration): Analysis page session-mode access control.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../../../i18n/index";

// ---------------------------------------------------------------------------
// Shared mocks — must be declared before any lazy module imports
// ---------------------------------------------------------------------------

// useFastAnalysis — controlled per-test; avoids real WebWorker in jsdom.
vi.mock("../useFastAnalysis", () => ({
  useFastAnalysis: vi.fn(),
}));

// react-chessboard — avoids canvas issues in jsdom.
vi.mock("react-chessboard", () => ({
  Chessboard: () => <div data-testid="chessboard" />,
}));

// useGameReplay / useReplayPlayer — used by AnalysisPage for online mode.
vi.mock("../../history/useGameReplay", () => ({
  useGameReplay: vi.fn(),
}));
vi.mock("../../history/useReplayPlayer", () => ({
  useReplayPlayer: () => ({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    lastMove: null,
    sideToMove: "white" as const,
    currentIndex: 0,
    totalMoves: 0,
    isPlaying: false,
    speed: 2000,
    first: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    last: vi.fn(),
    togglePlay: vi.fn(),
    jumpTo: vi.fn(),
    setSpeed: vi.fn(),
  }),
}));

// analysisService — network boundary.
vi.mock("../analysisService", () => ({
  fetchAnalysis: vi.fn().mockResolvedValue(null),
  writeMove: vi.fn().mockResolvedValue(undefined),
  finalize: vi.fn().mockResolvedValue(undefined),
}));

// useDeepAnalysis — deep-pass engine hook; kept idle by default.
vi.mock("../useDeepAnalysis", () => ({
  useDeepAnalysis: vi.fn(),
}));

// react-router-dom navigate spy.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Lazy imports — after all vi.mock() declarations
// ---------------------------------------------------------------------------

import { OnlineResultModal } from "../../online/OnlineResultModal";
import { MoveListAnnotated } from "../MoveListAnnotated";
import { GameRow } from "../../history/GameRow";
import { Analysis } from "../../../pages/Analysis";
import { useFastAnalysis } from "../useFastAnalysis";
import { useDeepAnalysis } from "../useDeepAnalysis";
import { useAnalysisStore } from "../useAnalysisStore";
import { useSessionAnalysisStore } from "../useSessionAnalysisStore";
import type { AnalysisMove, MoveCategory, GameListItem } from "@yanchess/shared";

const mockUseFastAnalysis = vi.mocked(useFastAnalysis);
const mockUseDeepAnalysis = vi.mocked(useDeepAnalysis);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal OnlineResultModal props — dialog open, no rematch in progress. */
function baseModalProps() {
  return {
    result: { winner: "white" as const, reason: "checkmate" as const },
    resultModalDismissed: false,
    myColor: "white" as const,
    ratingBefore: 1500,
    ratingAfter: 1516,
    ratingDelta: 16,
    pendingRematch: null,
    rematchExpiredToast: false,
    gameId: "game-ftr-xyz",
    movesSan: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"] as string[],
    onDismiss: vi.fn(),
    onNewGame: vi.fn(),
    onOfferRematch: vi.fn(),
    onRespondRematch: vi.fn(),
  };
}

/** Minimal GameListItem fixture. */
function makeGameItem(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    gameId: "game-ftr-001",
    mode: "Blitz",
    playerColor: "white",
    opponent: { nickname: "bob", country: null, ratingAfter: 1484 },
    result: "win",
    endReason: "checkmate",
    ratingBefore: 1500,
    ratingAfter: 1516,
    ratingDelta: 16,
    isRated: true,
    startedAt: "2026-10-01T18:00:00.000Z",
    endedAt: "2026-10-01T18:05:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// beforeEach — reset stores + default mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  useAnalysisStore.getState().reset();
  useSessionAnalysisStore.getState().clear();

  // Default: fast pass is still running (spinner state).
  mockUseFastAnalysis.mockReturnValue({
    status: "running",
    buckets: null,
  });

  // Default: deep analysis idle.
  mockUseDeepAnalysis.mockReturnValue({
    status: "idle",
    progress: { done: 0, total: 0 },
    moves: [],
    cancel: vi.fn(),
  });
});

// ===========================================================================
// Test 1 — §2.1 AC #1
// OnlineResultModal: when fast pass completes, three tiles render and their
// counts sum to the total number of player half-moves.
// ===========================================================================

describe("§2.1 Fast-pass summary — OnlineResultModal integration", () => {
  /**
   * AC: Given a player just finished a game with 6 half-moves total,
   * when the fast pass finishes,
   * then the three tiles (Standout / Normal / Mistake) are visible and
   * their counts sum to 6.
   *
   * @regression
   */
  it("@regression — tiles populate and counts sum to total half-moves after fast pass completes", () => {
    // Engine pass is done: standout=2, normal=3, mistake=1 → sum=6.
    mockUseFastAnalysis.mockReturnValue({
      status: "done",
      buckets: { standout: 2, normal: 3, mistake: 1 },
    });

    render(
      <MemoryRouter>
        <OnlineResultModal {...baseModalProps()} />
      </MemoryRouter>,
    );

    // All three tile labels must be visible.
    expect(screen.getByText("Standout")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Mistake")).toBeInTheDocument();

    // Derive counts from sibling spans inside each tile wrapper.
    // Each Tile renders: <span>{count}</span><span>{label}</span>
    // We locate each label's parent div and read the first child span.
    const tileFor = (label: string): number => {
      const labelEl = screen.getByText(label);
      const tileDiv = labelEl.closest("div")!;
      return parseInt(tileDiv.querySelector("span:first-child")!.textContent ?? "0", 10);
    };

    const standout = tileFor("Standout");
    const normal   = tileFor("Normal");
    const mistake  = tileFor("Mistake");

    // Sum equals total half-moves (6 in movesSan fixture).
    expect(standout + normal + mistake).toBe(6);
  });

  /**
   * Negative: if the fast pass is still running, tiles are NOT shown — only
   * the "Analyzing…" spinner text is present.
   *
   * AC: §2.1 — "The three tiles stay in a 'loading' state … until the fast
   * pass finishes."
   *
   * @regression
   */
  it("@regression — spinner visible and tiles absent while fast pass running", () => {
    // Default mock already returns status="running", buckets=null.
    render(
      <MemoryRouter>
        <OnlineResultModal {...baseModalProps()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(screen.queryByText("Standout")).not.toBeInTheDocument();
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
    expect(screen.queryByText("Mistake")).not.toBeInTheDocument();
  });

  /**
   * Negative: fast pass error → "Analysis not available." no tiles.
   *
   * AC: §2.1 — "If the fast pass fails … the section shows 'Analysis not available.'"
   *
   * @regression
   */
  it("@regression — 'Analysis not available.' shown when fast pass errors, tiles absent", () => {
    mockUseFastAnalysis.mockReturnValue({ status: "error", buckets: null });

    render(
      <MemoryRouter>
        <OnlineResultModal {...baseModalProps()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Analysis not available.")).toBeInTheDocument();
    expect(screen.queryByText("Standout")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Test 2 — §2.2 AC #2
// "Analyze" button is visible in OnlineResultModal regardless of fast-pass state.
// ===========================================================================

describe("§2.2 'Analyze' button in OnlineResultModal", () => {
  /**
   * AC: Given the result dialog is open,
   * when the player looks at the action buttons,
   * then they see the "Analyze" button alongside the other action buttons.
   *
   * @regression
   */
  it("@regression — Analyze button is present while fast pass is still running", () => {
    // Default mock: status="running" (spinner visible).
    render(
      <MemoryRouter>
        <OnlineResultModal {...baseModalProps()} />
      </MemoryRouter>,
    );

    // Spinner present = fast pass still running.
    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    // Analyze button must already be in the DOM.
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
  });

  /**
   * AC: Clicking "Analyze" while the fast pass is still running navigates to
   * the analysis page for this specific game.
   *
   * @regression
   */
  it("@regression — clicking Analyze navigates to /analysis/<gameId>", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OnlineResultModal {...baseModalProps()} gameId="gid-ftr-001" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(mockNavigate).toHaveBeenCalledWith("/analysis/gid-ftr-001");
  });
});

// ===========================================================================
// Test 3 — §2.4 AC (all 11 categories)
// MoveListAnnotated renders the correct glyph for all 11 categories.
// ===========================================================================

describe("§2.4 All 11 move categories — MoveListAnnotated glyphs", () => {
  /**
   * AC: Every move category has the correct inline glyph marker, or no glyph
   * for the four "no-marker" categories (Excellent / Good / Book / Forced).
   *
   * @regression
   */
  it("@regression — all 11 category glyphs render correctly (no marker for Excellent / Good / Book / Forced)", () => {
    const ALL_CATEGORIES: MoveCategory[] = [
      "Brilliant", "Great", "Best", "Excellent", "Good",
      "Book", "Forced", "Inaccuracy", "Mistake", "Blunder", "Miss",
    ];

    const EXPECTED_GLYPH: Record<MoveCategory, string | null> = {
      Brilliant:   "!!",
      Great:       "!",
      Best:        "★",
      Excellent:   null,
      Good:        null,
      Book:        null,
      Forced:      null,
      Inaccuracy:  "⁉",
      Mistake:     "?",
      Blunder:     "??",
      Miss:        "×",
    };

    // All glyphs that should never appear on no-marker categories.
    const ALL_GLYPHS = ["!!", "!", "★", "⁉", "?", "??", "×"];

    type TestMove = AnalysisMove & { san: string };

    const moves: TestMove[] = ALL_CATEGORIES.map((category, i) => ({
      moveIndex: i,
      playerColor: i % 2 === 0 ? ("white" as const) : ("black" as const),
      category,
      evaluationCp: 0,
      mateIn: null,
      bestMoveUci: "e2e4",
      san: `N${i}f3`,
    }));

    render(
      <MoveListAnnotated
        moves={moves}
        currentIndex={0}
        onMoveClick={vi.fn()}
        engineSuggestedSan={null}
      />,
    );

    ALL_CATEGORIES.forEach((category, i) => {
      const btn = screen.getByTestId(`move-btn-${i}`);
      const glyph = EXPECTED_GLYPH[category];

      if (glyph !== null) {
        expect(
          btn.textContent,
          `${category} should show glyph "${glyph}"`,
        ).toContain(glyph);
      } else {
        ALL_GLYPHS.forEach((g) => {
          expect(
            btn.textContent,
            `${category} should NOT show any glyph (found "${g}")`,
          ).not.toContain(g);
        });
      }
    });
  });
});

// ===========================================================================
// Test 4 — §2.5 AC #1
// GameRow shows "🔍 Analyze" link pointing to /analysis/<gameId>.
// ===========================================================================

describe("§2.5 'Analyze' link in GameRow", () => {
  /**
   * AC: Given a signed-in player opens /history, when they look at a game row,
   * then they see both "▶ Replay" and "🔍 Analyze" as inline actions.
   *
   * @regression
   */
  it("@regression — GameRow renders Analyze link with href /analysis/<gameId>", () => {
    const item = makeGameItem({ gameId: "ftr-game-888" });
    render(
      <MemoryRouter>
        <GameRow item={item} />
      </MemoryRouter>,
    );

    const analyzeLink = screen.getByRole("link", { name: /Analyz/i });
    expect(analyzeLink).toBeInTheDocument();
    expect((analyzeLink as HTMLAnchorElement).href).toContain("/analysis/ftr-game-888");
  });

  /**
   * Negative: clicking the Analyze link should NOT trigger the row's own
   * navigate() call (stopPropagation must be in place, matching the existing
   * Replay link pattern).
   *
   * @regression
   */
  it("@regression — Analyze link click does not bubble to row navigation", async () => {
    const user = userEvent.setup();
    mockNavigate.mockClear();

    render(
      <MemoryRouter>
        <GameRow item={makeGameItem({ gameId: "ftr-game-999" })} />
      </MemoryRouter>,
    );

    const analyzeLink = screen.getByRole("link", { name: /Analyz/i });
    await user.click(analyzeLink);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Test 5 — §2.6 AC #4
// /analysis/session: empty store → "no longer available" notice.
//                    populated store → analysis page mounts (no notice).
// ===========================================================================

describe("§2.6 /analysis/session — session-scoped access control", () => {
  /**
   * AC: Given a player opens the analysis page for an in-tab vs-bot session
   * after the page was reloaded (empty store),
   * when the page renders,
   * then they see the "no longer available" notice with a link back.
   *
   * @regression
   */
  it("@regression — empty session store renders 'no longer available' notice", () => {
    // Store cleared in beforeEach.
    render(
      <MemoryRouter initialEntries={["/analysis/session"]}>
        <Routes>
          <Route path="/analysis/session" element={<Analysis />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("session-not-available")).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
  });

  /**
   * Negative: when the session store is populated, the "no longer available"
   * notice must NOT render.
   *
   * @regression
   */
  it("@regression — populated session store does not show not-available notice", () => {
    useSessionAnalysisStore.getState().set({
      pgn: "1. e4 e5 2. Nf3 Nc6",
      playerColor: "white",
      source: "vs-bot",
    });

    render(
      <MemoryRouter initialEntries={["/analysis/session"]}>
        <Routes>
          <Route path="/analysis/session" element={<Analysis />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("session-not-available")).not.toBeInTheDocument();
  });

  /**
   * Negative: back link is present so the player can navigate away from the
   * "no longer available" page.
   *
   * @regression
   */
  it("@regression — back link present on not-available notice", () => {
    render(
      <MemoryRouter initialEntries={["/analysis/session"]}>
        <Routes>
          <Route path="/analysis/session" element={<Analysis />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("back-link")).toBeInTheDocument();
  });
});
