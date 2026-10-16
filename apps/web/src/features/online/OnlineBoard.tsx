import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineGameStore } from "./useOnlineGameStore";
import { useOnlineGameViewModel } from "./useOnlineGameViewModel";
import { useOnlineGameClock } from "./useOnlineGameClock";
import { useAuthStore } from "../auth/useAuthStore";
import { Board } from "../../components/game/Board";
import { Clock } from "../../components/game/Clock";
import { MoveHistory } from "../../components/game/MoveHistory";
import { PromotionDialog } from "../../components/game/PromotionDialog";
import { GameActions } from "../../components/game/GameActions";
import { ConfirmResignDialog } from "../../components/game/ConfirmResignDialog";
import { DrawOfferDialog } from "../../components/game/DrawOfferDialog";
import { Alert } from "../../components/ui/Alert";
import { OnlineResultModal } from "./OnlineResultModal";
import { UserFlag } from "../profile/UserFlag";

function PlayerCard({
  nickname,
  rating,
  online,
  country,
}: {
  nickname: string;
  rating: number;
  online?: boolean;
  country?: string | null;
}): JSX.Element {
  const { t } = useTranslation("game");
  const dotClass =
    online === false
      ? "inline-block w-2 h-2 rounded-full bg-text-muted"
      : "inline-block w-2 h-2 rounded-full bg-green-500";
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={dotClass} aria-label={online === false ? t("online.playerStatus.offline") : t("online.playerStatus.online")} />
      <span className="text-text-primary font-semibold truncate">{nickname}<UserFlag country={country ?? null} className="ml-1" /></span>
      <span className="text-text-muted text-sm tabular-nums">{rating}</span>
    </div>
  );
}

export function OnlineBoard(): JSX.Element {
  const { t } = useTranslation("game");
  const vm = useOnlineGameViewModel();
  const opponent = useOnlineGameStore((s) => s.opponent);
  const mode = useOnlineGameStore((s) => s.mode);
  const color = useOnlineGameStore((s) => s.color);
  const result = useOnlineGameStore((s) => s.result);
  const resultModalDismissed = useOnlineGameStore((s) => s.resultModalDismissed);
  const ratingDelta = useOnlineGameStore((s) => s.ratingDelta);
  const ratingsAfter = useOnlineGameStore((s) => s.ratingsAfter);
  const drawDeclinedToast = useOnlineGameStore((s) => s.drawDeclinedToast);
  const drawOfferCooldownMoves = useOnlineGameStore((s) => s.drawOfferCooldownMoves);
  const pendingRematch = useOnlineGameStore((s) => s.pendingRematch);
  const rematchExpiredToast = useOnlineGameStore((s) => s.rematchExpiredToast);
  const offerRematch = useOnlineGameStore((s) => s.offerRematch);
  const respondRematch = useOnlineGameStore((s) => s.respondRematch);
  const tickingClocks = useOnlineGameClock();

  const user = useAuthStore((s) => s.user);
  const selfNickname = user?.nickname ?? "—";
  const selfRating = user?.ratings?.find((r) => r.mode === mode)?.rating ?? 1500;

  const opponentNickname = opponent?.nickname ?? "—";
  const opponentRating = opponent?.rating ?? 1500;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // Reset selected square when interaction is disabled or FEN changes
  useEffect(() => {
    if (!vm?.canInteract) setSelectedSquare(null);
  }, [vm?.canInteract, vm?.fen]);

  if (vm === null) {
    return <div className="text-text-muted text-center py-10">{t("online.loadingGame")}</div>;
  }

  const orientation = color === "black" ? "black" : "white";

  // Top = opponent's clock, bottom = self's clock (ticking values from useOnlineGameClock)
  const topMs = orientation === "white" ? tickingClocks.blackMs : tickingClocks.whiteMs;
  const bottomMs = orientation === "white" ? tickingClocks.whiteMs : tickingClocks.blackMs;
  const topIsActive = orientation === "white" ? vm.sideToMove === "black" : vm.sideToMove === "white";
  const bottomIsActive = orientation === "white" ? vm.sideToMove === "white" : vm.sideToMove === "black";

  // Promoting color: derived from sideToMove (the player making the move)
  const promotingColor: "w" | "b" = vm.sideToMove === "white" ? "w" : "b";

  function handleSelectSquare(sq: string): void {
    setSelectedSquare(sq || null);
    vm?.onSelectSquare(sq);
  }

  // Compute ratingBefore from ratingsAfter and ratingDelta (perspective-aware)
  const ratingAfterVal =
    ratingsAfter !== null && color !== null
      ? color === "white"
        ? ratingsAfter.white
        : ratingsAfter.black
      : null;
  const ratingBeforeVal =
    ratingAfterVal !== null && ratingDelta !== null
      ? ratingAfterVal - ratingDelta
      : null;

  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-6">
      {/* Board column */}
      <div className="flex flex-col items-center w-full max-w-[560px] mx-auto gap-2">
        {/* Opponent (top) */}
        <PlayerCard nickname={opponentNickname} rating={opponentRating} online={opponent?.online} country={opponent?.country ?? null} />
        <Clock ms={topMs} isActive={topIsActive} />

        <Board
          fen={vm.fen}
          boardOrientation={vm.boardOrientation}
          canInteract={vm.canInteract}
          lastMove={vm.lastMove}
          pendingPromotion={vm.pendingPromotion}
          selectedSquare={selectedSquare}
          onMove={(move) => {
            vm.onMove(move);
            setSelectedSquare(null);
          }}
          onSelectSquare={handleSelectSquare}
        />

        {/* Self (bottom) */}
        <Clock ms={bottomMs} isActive={bottomIsActive} />
        <PlayerCard nickname={selfNickname} rating={selfRating} online={true} country={user?.country ?? null} />

        <GameActions
          canAct={vm.result === null}
          onResignClick={vm.onResignClick}
          onOfferDraw={vm.onOfferDraw}
        />
        {drawDeclinedToast && (
          <Alert tone="info">{t("online.drawDeclined")}</Alert>
        )}
        {drawOfferCooldownMoves !== null && (
          <Alert tone="info">
            {t("online.drawCooldown", { moves: drawOfferCooldownMoves })}
          </Alert>
        )}
      </div>

      {/* Move history */}
      <section className="flex flex-col gap-2 w-full md:w-auto" aria-labelledby="online-moves-heading">
        <h2 id="online-moves-heading" className="text-sm text-text-secondary px-1">{t("board.movesHeading")}</h2>
        <MoveHistory movesSan={vm.movesSan} />
      </section>

      {/* Dialogs */}
      <PromotionDialog
        pending={vm.pendingPromotion}
        promotingColor={promotingColor}
        onPromote={vm.onPromote}
        onCancel={vm.onCancelPromotion}
      />
      <ConfirmResignDialog
        open={vm.pendingResign}
        activeColor={vm.sideToMove}
        onConfirm={vm.onResignConfirm}
        onCancel={vm.onResignCancel}
      />
      <DrawOfferDialog
        pending={vm.pendingDrawOffer}
        onRespond={vm.onRespondDraw}
      />
      {vm.result !== null && (
        <OnlineResultModal
          result={vm.result}
          resultModalDismissed={resultModalDismissed}
          myColor={color ?? "white"}
          ratingBefore={ratingBeforeVal}
          ratingAfter={ratingAfterVal}
          ratingDelta={ratingDelta}
          onDismiss={vm.onDismissResult}
          onNewGame={vm.onNewGame}
          pendingRematch={pendingRematch}
          rematchExpiredToast={rematchExpiredToast}
          onOfferRematch={offerRematch}
          onRespondRematch={respondRematch}
        />
      )}
    </div>
  );
}
