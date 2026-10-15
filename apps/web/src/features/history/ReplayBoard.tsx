import { useTranslation } from "react-i18next";
import { Board } from "../../components/game/Board";
import { Clock } from "../../components/game/Clock";
import { MoveHistory } from "../../components/game/MoveHistory";
import type { ReplayData } from "./useGameReplay";

interface PlayerCardProps {
  nickname: string;
  ratingAfter: number;
  ratingDelta?: number;
}

function PlayerCard({ nickname, ratingAfter, ratingDelta }: PlayerCardProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-text-primary font-semibold truncate">{nickname}</span>
      <span className="text-text-muted text-sm tabular-nums">{ratingAfter}</span>
      {ratingDelta !== undefined && (
        <span
          className={`text-sm font-medium tabular-nums ${
            ratingDelta > 0
              ? "text-success"
              : ratingDelta < 0
                ? "text-danger"
                : "text-text-muted"
          }`}
        >
          {ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta < 0 ? `−${Math.abs(ratingDelta)}` : "0"}
        </span>
      )}
    </div>
  );
}

interface ReplayBoardProps {
  data: ReplayData;
  fen: string;
  lastMove: { from: string; to: string } | null;
  sideToMove: "white" | "black";
  currentIndex: number;
  onMoveClick: (index: number) => void;
}

export function ReplayBoard({
  data,
  fen,
  lastMove,
  currentIndex,
  onMoveClick,
}: ReplayBoardProps): JSX.Element {
  const { t } = useTranslation("history");
  const { myColor, white, black, timeControlMs, movesSan } = data;

  const opponent = myColor === "white" ? black : white;
  const self = myColor === "white" ? white : black;

  const opponentRatingDelta = opponent.ratingAfter - opponent.ratingBefore;
  const selfRatingDelta = self.ratingAfter - self.ratingBefore;

  // SAN[0] corresponds to currentIndex=1, so highlightIndex = currentIndex - 1
  const highlightIndex = currentIndex > 0 ? currentIndex - 1 : undefined;

  // onMoveClick(sanIndex) → jumpTo(sanIndex + 1)
  const handleMoveClick = (sanIndex: number): void => {
    onMoveClick(sanIndex + 1);
  };

  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-6">
      {/* Board column */}
      <div className="flex flex-col items-center w-full max-w-[560px] mx-auto gap-2">
        {/* Opponent (top) */}
        <PlayerCard
          nickname={opponent.nickname}
          ratingAfter={opponent.ratingAfter}
          ratingDelta={opponentRatingDelta}
        />
        <Clock ms={timeControlMs} isActive={false} />

        <Board
          fen={fen}
          boardOrientation={myColor}
          canInteract={false}
          lastMove={lastMove}
          pendingPromotion={null}
          selectedSquare={null}
          onMove={() => {}}
          onSelectSquare={() => {}}
        />

        <Clock ms={timeControlMs} isActive={false} />

        {/* Self (bottom) */}
        <PlayerCard
          nickname={self.nickname}
          ratingAfter={self.ratingAfter}
          ratingDelta={selfRatingDelta}
        />
      </div>

      {/* Move history */}
      <section className="flex flex-col gap-2 w-full md:w-auto" aria-labelledby="replay-moves-heading">
        <h2 id="replay-moves-heading" className="text-sm text-text-secondary px-1">{t("replay.movesHeading")}</h2>
        <MoveHistory
          movesSan={movesSan}
          highlightIndex={highlightIndex}
          onMoveClick={handleMoveClick}
        />
      </section>
    </div>
  );
}
