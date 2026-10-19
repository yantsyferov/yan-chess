/**
 * AnalysisPage — orchestrator for /analysis/:gameId and /analysis/session.
 *
 * Online mode (gameId set):
 *   mount → fetching-cache
 *     → cached (completedAt set + classifierVersion matches) → full UI
 *     → running-deep (cache miss or stale) → AnalysisProgressView → full UI
 *   error → error card + retry button
 *
 * Session mode (sessionPayload set, gameId undefined):
 *   mount → running-deep (no cache check) → full UI
 *   No backend writes; analysis is purely client-side.
 */

import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import type { AnalysisResponse } from "@yanchess/shared";
import type { SessionAnalysisPayload } from "./useSessionAnalysisStore";

import { useGameReplay } from "../history/useGameReplay";
import { useReplayPlayer } from "../history/useReplayPlayer";
import { ReplayControls } from "../history/ReplayControls";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

import { useAnalysisStore } from "./useAnalysisStore";
import type { AnalyzedMoveFull } from "./useAnalysisStore";
import { fetchAnalysis } from "./analysisService";
import { useDeepAnalysis } from "./useDeepAnalysis";
import type { AnalyzedMove } from "./useDeepAnalysis";
import { CLASSIFIER_VERSION } from "./classifier";
import { EvalBar } from "./EvalBar";
import { AnalysisBoard } from "./AnalysisBoard";
import { MoveListAnnotated } from "./MoveListAnnotated";
import { AnalysisProgressView } from "./AnalysisProgressView";

interface AnalysisPageProps {
  /** Set for online games. Undefined in session mode (vs-bot / hotseat). */
  gameId?: string;
  /** Set for session games (vs-bot / hotseat). Skips backend cache check. */
  sessionPayload?: SessionAnalysisPayload;
}

// ---------------------------------------------------------------------------
// Helper: derive fenAfter for each move from PGN
// ---------------------------------------------------------------------------
function buildFensFromPgn(pgn: string): string[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }
  const history = chess.history({ verbose: true });
  const replay = new Chess();
  const fens: string[] = [];
  for (const move of history) {
    replay.move(move);
    fens.push(replay.fen());
  }
  return fens;
}

// ---------------------------------------------------------------------------
// Helper: convert AnalysisResponse (from cache) → AnalyzedMoveFull[]
// We need san + playedUci from the PGN; the response only has the analysis fields.
// ---------------------------------------------------------------------------
function analysisResponseToMoveFull(
  response: AnalysisResponse,
  pgn: string
): AnalyzedMoveFull[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }
  const history = chess.history({ verbose: true });
  const fens = buildFensFromPgn(pgn);

  return response.moves.map((move, i) => {
    const hm = history[i];
    return {
      ...move,
      san: hm?.san ?? "",
      playedUci: hm ? hm.from + hm.to + (hm.promotion ?? "") : "",
      fenAfter: fens[i] ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Helper: convert AnalyzedMove (from hook) → AnalyzedMoveFull
// ---------------------------------------------------------------------------
function hookMoveToFull(
  move: AnalyzedMove,
  fenAfter: string
): AnalyzedMoveFull {
  return {
    moveIndex: move.moveIndex,
    playerColor: move.playerColor,
    san: move.san,
    playedUci: move.playedUci,
    category: move.category,
    evaluationCp: move.evaluationCp,
    mateIn: move.mateIn,
    bestMoveUci: move.bestMoveUci,
    fenAfter,
  };
}

// ---------------------------------------------------------------------------
// Sub-component: loading state while game data fetches
// ---------------------------------------------------------------------------
function GameLoadingView(): JSX.Element {
  const { t } = useTranslation("history");
  return (
    <div className="text-text-muted text-center py-10" data-testid="game-loading">
      {t("replay.loadingGame")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: error state with optional retry
// ---------------------------------------------------------------------------
interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

function ErrorView({ message, onRetry }: ErrorViewProps): JSX.Element {
  const { t } = useTranslation("analysis");
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Card>
        <p className="text-text-secondary mb-3">{message}</p>
        {onRetry !== undefined && (
          <Button onClick={onRetry}>{t("buttons.tryAgain", "Try again")}</Button>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: full analysis UI (eval bar + board + side panel)
// ---------------------------------------------------------------------------
interface FullAnalysisUIProps {
  moves: AnalyzedMoveFull[];
  boardOrientation: "white" | "black";
  pgn: string;
  opponentNickname: string;
  onBack: () => void;
}

function FullAnalysisUI({
  moves,
  boardOrientation,
  pgn,
  opponentNickname,
  onBack,
}: FullAnalysisUIProps): JSX.Element {
  const { t } = useTranslation("analysis");

  // Build verbose move list from pgn for useReplayPlayer
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    // ignore
  }
  const history = chess.history({ verbose: true });
  const verboseMoves = history.map((m) => ({
    from: m.from,
    to: m.to,
    promotion: m.promotion,
    san: m.san,
  }));

  const player = useReplayPlayer(verboseMoves);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLButtonElement) return;
      switch (e.key) {
        case "ArrowLeft":
          player.prev();
          break;
        case "ArrowRight":
          player.next();
          break;
        case "Home":
          player.first();
          break;
        case "End":
          player.last();
          break;
        case " ":
          e.preventDefault();
          player.togglePlay();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [player.prev, player.next, player.first, player.last, player.togglePlay]);

  // Current move data (0-based index is currentIndex - 1 because index=0 means starting pos)
  const currentMoveIdx = player.currentIndex - 1;
  const currentMove = moves[currentMoveIdx] ?? null;

  const evalCp = currentMove?.evaluationCp ?? null;
  const mateIn = currentMove?.mateIn ?? null;
  const bestMoveUci = currentMove?.bestMoveUci ?? null;

  // Derive best move SAN for display
  let engineSuggestedSan: string | null = null;
  if (bestMoveUci && bestMoveUci.length >= 4) {
    try {
      const tempChess = new Chess(player.fen);
      const move = tempChess.move({
        from: bestMoveUci.slice(0, 2),
        to: bestMoveUci.slice(2, 4),
        promotion: bestMoveUci.length > 4 ? bestMoveUci[4] : undefined,
      });
      engineSuggestedSan = move?.san ?? null;
    } catch {
      engineSuggestedSan = null;
    }
  }

  // Board height for EvalBar sync
  const BOARD_HEIGHT = 560;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Back link + heading */}
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          data-testid="back-link"
        >
          {t("buttons.back")}
        </button>
        <h1 className="text-xl font-semibold text-text-primary">
          {t("page.heading", { opponent: opponentNickname })}
        </h1>
      </div>

      {/* Main layout: EvalBar + Board + Side panel */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Evaluation bar */}
        <div className="shrink-0 hidden md:flex">
          <EvalBar
            evaluationCp={evalCp}
            mateIn={mateIn}
            boardHeight={BOARD_HEIGHT}
          />
        </div>

        {/* Board (horizontal eval bar on mobile) */}
        <div className="flex flex-col items-center gap-2 w-full md:w-auto">
          {/* Mobile eval bar — horizontal strip */}
          <div className="flex md:hidden w-full items-center gap-2">
            <EvalBar
              evaluationCp={evalCp}
              mateIn={mateIn}
              boardHeight={32}
            />
          </div>
          <AnalysisBoard
            fen={player.fen}
            bestMoveUci={bestMoveUci}
            boardOrientation={boardOrientation}
          />
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 flex-1 min-w-0 md:max-w-xs">
          <MoveListAnnotated
            moves={moves}
            currentIndex={player.currentIndex}
            onMoveClick={player.jumpTo}
            engineSuggestedSan={engineSuggestedSan}
          />
          <ReplayControls
            currentIndex={player.currentIndex}
            totalMoves={player.totalMoves}
            onFirst={player.first}
            onPrev={player.prev}
            onNext={player.next}
            onLast={player.last}
            isPlaying={player.isPlaying}
            onTogglePlay={player.togglePlay}
            speed={player.speed}
            onSpeedChange={player.setSpeed}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deep analysis runner — inner component that mounts the hook
// ---------------------------------------------------------------------------
interface DeepRunnerProps {
  pgn: string;
  gameId?: string;
  onCancel: () => void;
}

function DeepRunner({ pgn, gameId, onCancel }: DeepRunnerProps): JSX.Element {
  const store = useAnalysisStore();

  const fens = buildFensFromPgn(pgn);

  const deep = useDeepAnalysis({
    pgn,
    gameId,
    enabled: true,
    onProgress(progress) {
      store.setProgress(progress);
    },
    onMove(move) {
      const fenAfter = fens[move.moveIndex] ?? "";
      store.appendMove(hookMoveToFull(move, fenAfter));
      store.setStatus("running-deep");
    },
    onComplete(moves) {
      const fullMoves = moves.map((m) =>
        hookMoveToFull(m, fens[m.moveIndex] ?? "")
      );
      store.finishRun(fullMoves);
    },
    onError(err) {
      store.setError(err.message);
    },
  });

  const handleCancel = useCallback((): void => {
    deep.cancel();
    store.cancelRun();
    onCancel();
  }, [deep, store, onCancel]);

  return (
    <AnalysisProgressView
      done={deep.progress.done}
      total={deep.progress.total}
      onCancel={handleCancel}
    />
  );
}

// ---------------------------------------------------------------------------
// Session mode inner component — no backend calls, deep pass runs in-tab only
// ---------------------------------------------------------------------------
interface SessionAnalysisPageProps {
  payload: SessionAnalysisPayload;
}

function SessionAnalysisPage({ payload }: SessionAnalysisPageProps): JSX.Element {
  const { t } = useTranslation("analysis");
  const navigate = useNavigate();
  const location = useLocation();

  const store = useAnalysisStore();
  const SESSION_KEY = "session";

  const returnTo: string =
    (location.state as { returnTo?: string } | null)?.returnTo ??
    (payload.source === "hotseat" ? "/game" : "/play/ai");

  const handleCancelBack = useCallback((): void => {
    navigate(returnTo);
  }, [navigate, returnTo]);

  const handleBack = useCallback((): void => {
    navigate(returnTo);
  }, [navigate, returnTo]);

  // On mount: start a fresh deep pass (no cache for session games).
  useEffect(() => {
    if (
      store.activeKey === SESSION_KEY &&
      (store.status === "done" ||
        store.status === "running-deep")
    ) {
      return;
    }
    store.startRun(SESSION_KEY);
    store.setStatus("running-deep");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.pgn]);

  const opponentNickname = payload.source === "vs-bot" ? "Bot" : "Opponent";

  if (store.status === "done") {
    return (
      <FullAnalysisUI
        moves={store.moves}
        boardOrientation={payload.playerColor}
        pgn={payload.pgn}
        opponentNickname={opponentNickname}
        onBack={handleBack}
      />
    );
  }

  if (store.status === "running-deep") {
    return (
      <DeepRunner
        pgn={payload.pgn}
        gameId={undefined}
        onCancel={handleCancelBack}
      />
    );
  }

  if (store.status === "error") {
    return (
      <ErrorView
        message={store.error ?? t("status.notAvailable")}
      />
    );
  }

  return (
    <div className="text-text-muted text-center py-10" data-testid="fetching-cache">
      {/* Initial / transitioning */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Online mode component — fetches cache from backend then runs deep pass
// ---------------------------------------------------------------------------
interface OnlineAnalysisPageProps {
  gameId: string;
}

function OnlineAnalysisPage({ gameId }: OnlineAnalysisPageProps): JSX.Element {
  const { t } = useTranslation("analysis");
  const navigate = useNavigate();
  const location = useLocation();

  const store = useAnalysisStore();
  const { loading: gameLoading, error: gameError, data: gameData, refetch } = useGameReplay(gameId);

  const returnTo: string = (location.state as { returnTo?: string } | null)?.returnTo ?? "/";

  const handleBack = useCallback((): void => {
    navigate(returnTo);
  }, [navigate, returnTo]);

  const handleCancelBack = useCallback((): void => {
    navigate(returnTo);
  }, [navigate, returnTo]);

  const handleRetry = useCallback((): void => {
    store.reset();
    refetch();
  }, [store, refetch]);

  // On mount (or when gameId/gameData changes): probe cache then decide path
  useEffect(() => {
    if (gameLoading || gameData === null) return;
    // If already in a terminal state for this key, don't restart
    if (
      store.activeKey === gameId &&
      (store.status === "cached" ||
        store.status === "done" ||
        store.status === "running-deep")
    ) {
      return;
    }

    store.startRun(gameId);

    void (async () => {
      try {
        const response = await fetchAnalysis(gameId);

        if (
          response !== null &&
          response.completedAt !== null &&
          response.classifierVersion === CLASSIFIER_VERSION
        ) {
          // Cache hit — convert response moves to full moves with san/fen
          const fullMoves = analysisResponseToMoveFull(response, gameData.pgn);
          store.loadCached(gameId, {
            moves: fullMoves,
            classifierVersion: response.classifierVersion,
            engineDepth: response.engineDepth,
            completedAt: response.completedAt,
          });
        } else {
          // Cache miss / stale / no analysis → start deep pass
          store.setStatus("running-deep");
        }
      } catch {
        store.setError(t("status.notAvailable", "Analysis not available."));
      }
    })();
    // Depend only on stable inputs; callbacks are stable refs via Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, gameLoading, gameData]);

  // --- Game loading state ---
  if (gameLoading) {
    return <GameLoadingView />;
  }

  // --- Game fetch error ---
  if (gameError === "forbidden") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-3">
            {t("status.gameNotAvailable")}
          </h2>
          <Button variant="secondary" onClick={() => navigate("/history")}>
            {t("buttons.back")}
          </Button>
        </Card>
      </div>
    );
  }

  if (gameError === "network") {
    return (
      <ErrorView
        message={t("status.notAvailable", "Could not load game.")}
        onRetry={handleRetry}
      />
    );
  }

  if (gameData === null) return <></>;

  const opponent = gameData.myColor === "white" ? gameData.black : gameData.white;

  // --- Store error state ---
  if (store.status === "error") {
    return (
      <ErrorView
        message={store.error ?? t("status.notAvailable")}
        onRetry={handleRetry}
      />
    );
  }

  // --- Cancelled ---
  if (store.status === "cancelled") {
    return <GameLoadingView />;
  }

  // --- Full UI (cached or deep pass done) ---
  if (store.status === "cached" || store.status === "done") {
    return (
      <FullAnalysisUI
        moves={store.moves}
        boardOrientation={gameData.myColor}
        pgn={gameData.pgn}
        opponentNickname={opponent.nickname}
        onBack={handleBack}
      />
    );
  }

  // --- Deep pass running ---
  if (store.status === "running-deep") {
    return (
      <DeepRunner
        pgn={gameData.pgn}
        gameId={gameId}
        onCancel={handleCancelBack}
      />
    );
  }

  // --- Initial / fetching-cache ---
  return (
    <div className="text-text-muted text-center py-10" data-testid="fetching-cache">
      {t("status.loading")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — routes to session or online branch
// ---------------------------------------------------------------------------
export function AnalysisPage({ gameId, sessionPayload }: AnalysisPageProps): JSX.Element {
  if (sessionPayload !== undefined) {
    return <SessionAnalysisPage payload={sessionPayload} />;
  }
  return <OnlineAnalysisPage gameId={gameId!} />;
}
