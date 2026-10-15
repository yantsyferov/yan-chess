import { useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { useGameReplay } from "../features/history/useGameReplay";
import { useReplayPlayer } from "../features/history/useReplayPlayer";
import { ReplayBoard } from "../features/history/ReplayBoard";
import { ReplayControls } from "../features/history/ReplayControls";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function HistoryReplay(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "";

  const { loading, error, data, refetch } = useGameReplay(gameId!);
  const player = useReplayPlayer(data?.verboseMoves ?? []);

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

  if (loading) return <div className="text-text-muted text-center py-10">Loading game…</div>;

  if (error === "forbidden") {
    return (
      <div className="max-w-5xl mx-auto px-3 py-6 sm:px-4 sm:py-10">
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Game not available</h2>
          <Link
            to={`/profile${returnTo}`}
            className="text-accent hover:text-accent-hover text-sm"
          >
            ← Back to history
          </Link>
        </Card>
      </div>
    );
  }

  if (error === "network") {
    return (
      <div className="max-w-5xl mx-auto px-3 py-6 sm:px-4 sm:py-10">
        <Card>
          <p className="text-text-secondary mb-3">Couldn't load game.</p>
          <Button onClick={refetch}>Try again</Button>
        </Card>
      </div>
    );
  }

  if (!data) return <></>;

  return (
    <div className="max-w-5xl mx-auto px-3 py-6 sm:px-4 sm:py-10">
      <Link
        to={`/profile${returnTo}`}
        className="text-accent hover:text-accent-hover text-sm mb-4 inline-block"
      >
        ← Back to history
      </Link>
      <ReplayBoard
        data={data}
        fen={player.fen}
        lastMove={player.lastMove}
        sideToMove={player.sideToMove}
        currentIndex={player.currentIndex}
        onMoveClick={player.jumpTo}
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
  );
}
