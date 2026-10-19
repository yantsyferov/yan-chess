import { useTranslation } from "react-i18next";
import type { AnalysisMove, MoveCategory } from "@yanchess/shared";

const CATEGORY_GLYPH: Record<MoveCategory, string> = {
  Brilliant: "!!",
  Great: "!",
  Best: "★",
  Excellent: "",
  Good: "",
  Book: "",
  Forced: "",
  Inaccuracy: "⁉",
  Mistake: "?",
  Blunder: "??",
  Miss: "×",
};

interface AnalyzedMove extends AnalysisMove {
  san: string;
}

interface MoveListAnnotatedProps {
  moves: AnalyzedMove[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
  engineSuggestedSan: string | null;
}

interface FullMoveRow {
  moveNumber: number;
  white: AnalyzedMove | null;
  black: AnalyzedMove | null;
}

function groupIntoFullMoves(moves: AnalyzedMove[]): FullMoveRow[] {
  const rows: FullMoveRow[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.playerColor === "white") {
      const next = moves[i + 1];
      const blackMove = next && next.playerColor === "black" ? next : null;
      rows.push({
        moveNumber: Math.floor(move.moveIndex / 2) + 1,
        white: move,
        black: blackMove,
      });
      if (blackMove) i++;
    } else {
      // Black-only (game started from a position or odd start)
      rows.push({
        moveNumber: Math.floor(move.moveIndex / 2) + 1,
        white: null,
        black: move,
      });
    }
  }
  return rows;
}

export function MoveListAnnotated({
  moves,
  currentIndex,
  onMoveClick,
  engineSuggestedSan,
}: MoveListAnnotatedProps): JSX.Element {
  const { t } = useTranslation("analysis");
  const rows = groupIntoFullMoves(moves);

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-y-auto max-h-96 pr-1">
        {rows.map((row) => (
          <div
            key={row.moveNumber}
            className="flex items-center gap-1 text-sm"
          >
            <span className="text-text-muted w-6 shrink-0 text-right tabular-nums select-none">
              {row.moveNumber}.
            </span>

            {row.white !== null ? (
              <MoveButton
                move={row.white}
                isActive={currentIndex === row.white.moveIndex + 1}
                onClick={onMoveClick}
                categoryLabel={t(`categories.${row.white.category.toLowerCase()}`)}
              />
            ) : (
              <span className="w-20" />
            )}

            {row.black !== null && (
              <MoveButton
                move={row.black}
                isActive={currentIndex === row.black.moveIndex + 1}
                onClick={onMoveClick}
                categoryLabel={t(`categories.${row.black.category.toLowerCase()}`)}
              />
            )}
          </div>
        ))}
      </div>

      {engineSuggestedSan !== null && (
        <p
          className="text-sm text-text-secondary mt-2 px-1"
          data-testid="engine-suggests"
        >
          {t("engineSuggests", { san: engineSuggestedSan })}
        </p>
      )}
    </div>
  );
}

interface MoveButtonProps {
  move: AnalyzedMove;
  isActive: boolean;
  onClick: (index: number) => void;
  categoryLabel: string;
}

function MoveButton({
  move,
  isActive,
  onClick,
  categoryLabel,
}: MoveButtonProps): JSX.Element {
  const glyph = CATEGORY_GLYPH[move.category];

  return (
    <button
      onClick={() => onClick(move.moveIndex + 1)}
      title={categoryLabel}
      className={`
        flex items-center gap-0.5 px-1.5 py-0.5 rounded text-left w-20 truncate
        transition-colors font-mono
        ${isActive
          ? "bg-accent text-text-inverse"
          : "text-text-primary hover:bg-surface-elevated"
        }
      `}
      data-testid={`move-btn-${move.moveIndex}`}
    >
      <span>{move.san}</span>
      {glyph && (
        <span
          className="text-xs font-sans shrink-0"
          aria-hidden="true"
        >
          {glyph}
        </span>
      )}
    </button>
  );
}
