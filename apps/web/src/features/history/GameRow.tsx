import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameListItem, GameEndReason } from "@yanchess/shared";
import { MODE_LABELS } from "../shared/mode-labels";
import { UserIdentity } from "../profile/UserIdentity";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "0";
}

const ROW_BG: Record<GameListItem["result"], string> = {
  win: "bg-green-900/10",
  loss: "bg-red-900/10",
  draw: "",
};

interface GameRowProps {
  item: GameListItem;
}

export function GameRow({ item }: GameRowProps): JSX.Element {
  const { t } = useTranslation("history");
  const { t: tGame } = useTranslation("game");
  const location = useLocation();
  const navigate = useNavigate();
  const replayTo = `/history/${item.gameId}`;
  const replayState = { returnTo: location.search };

  function endReasonLabel(reason: GameEndReason): string {
    switch (reason) {
      case "checkmate": return t("endReason.checkmate");
      case "stalemate": return t("endReason.stalemate");
      case "insufficient_material": return t("endReason.insufficient_material");
      case "threefold_repetition": return t("endReason.threefold_repetition");
      case "fifty_move": return t("endReason.fifty_move");
      case "flag": return t("endReason.flag");
      case "flag_vs_insufficient_material": return t("endReason.flag_vs_insufficient_material");
      case "resignation": return t("endReason.resignation");
      case "agreement": return t("endReason.agreement");
      default: {
        const _exhaustive: never = reason;
        return String(_exhaustive);
      }
    }
  }

  function handleRowClick(): void {
    navigate(replayTo, { state: replayState });
  }

  const resultLabel = t(`resultLabels.${item.result}`);

  return (
    <div
      role="row"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 cursor-pointer hover:bg-surface-elevated transition-colors ${ROW_BG[item.result]}`}
      onClick={handleRowClick}
    >
      <span className="text-sm text-text-muted w-36 shrink-0">{formatDate(item.startedAt)}</span>

      <span className="text-sm text-text-primary grow">
        <UserIdentity nickname={item.opponent.nickname} country={item.opponent.country} rating={item.opponent.ratingAfter} />
      </span>

      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary shrink-0">
        {MODE_LABELS[item.mode]}
      </span>

      {item.isRated ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent shrink-0">
          {tGame("history.ratedBadge")}
        </span>
      ) : (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary shrink-0">
          {tGame("history.casualBadge")}
        </span>
      )}

      <span className="text-sm font-medium text-text-primary shrink-0">
        {resultLabel}
        <span className="text-text-muted font-normal"> — {endReasonLabel(item.endReason)}</span>
      </span>

      <span className={`text-sm font-medium shrink-0 tabular-nums ${item.ratingDelta > 0 ? "text-success" : item.ratingDelta < 0 ? "text-danger" : "text-text-muted"}`}>
        {formatDelta(item.ratingDelta)}
      </span>

      <Link
        to={replayTo}
        state={replayState}
        className="text-sm text-accent hover:text-accent-hover shrink-0"
        onClick={(e) => { e.stopPropagation(); }}
      >
        &#9654; {t("replay.link")}
      </Link>
    </div>
  );
}
