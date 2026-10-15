import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface MovePair {
  number: number;
  white: string | undefined;
  black: string | undefined;
}

interface MoveHistoryProps {
  movesSan: string[];
  /** 0-based SAN index of the currently highlighted move. Undefined = no highlight. */
  highlightIndex?: number;
  /** Called with the 0-based SAN index when a move is clicked. */
  onMoveClick?: (index: number) => void;
}

export function MoveHistory({ movesSan, highlightIndex, onMoveClick }: MoveHistoryProps): JSX.Element {
  const { t } = useTranslation("game");
  const containerRef = useRef<HTMLDivElement>(null);

  const pairs: MovePair[] = [];
  for (let i = 0; i < movesSan.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: movesSan[i],
      black: movesSan[i + 1],
    });
  }

  // When highlightIndex is provided (replay mode), use it; otherwise highlight the last move.
  const activeIndex = highlightIndex !== undefined ? highlightIndex : movesSan.length - 1;
  const lastIsWhite = activeIndex >= 0 && activeIndex % 2 === 0;
  const lastIsBlack = activeIndex >= 0 && activeIndex % 2 === 1;
  const activePairIndex = activeIndex >= 0 ? Math.floor(activeIndex / 2) : -1;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [movesSan]);

  return (
    <div
      ref={containerRef}
      data-testid="move-history"
      className="max-h-[400px] overflow-y-auto border border-border-subtle rounded-xl bg-surface-elevated p-3 w-full max-w-[280px]"
    >
      {pairs.length === 0 ? (
        <p className="text-sm text-text-muted">{t("moveHistory.empty")}</p>
      ) : (
        <table className="w-full text-sm text-text-primary tabular-nums">
          <tbody>
            {pairs.map(({ number, white, black }, idx) => {
              const whiteIdx = (idx * 2);
              const blackIdx = (idx * 2) + 1;
              const isActiveWhite = idx === activePairIndex && lastIsWhite;
              const isActiveBlack = idx === activePairIndex && lastIsBlack;
              return (
                <tr key={number}>
                  <td className="pr-2 py-1 text-text-muted w-8">{number}.</td>
                  <td
                    className={`px-2 py-1 rounded${isActiveWhite ? " bg-surface-overlay" : ""}${onMoveClick !== undefined && white !== undefined ? " cursor-pointer hover:bg-surface-overlay/60" : ""}`}
                    onClick={onMoveClick !== undefined && white !== undefined ? () => { onMoveClick(whiteIdx); } : undefined}
                  >
                    {white ?? ""}
                  </td>
                  <td
                    className={`px-2 py-1 rounded${isActiveBlack ? " bg-surface-overlay" : ""}${onMoveClick !== undefined && black !== undefined ? " cursor-pointer hover:bg-surface-overlay/60" : ""}`}
                    onClick={onMoveClick !== undefined && black !== undefined ? () => { onMoveClick(blackIdx); } : undefined}
                  >
                    {black ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
