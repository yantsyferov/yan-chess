import { useState, useEffect } from "react";
import { useVsBotStore } from "./useVsBotStore";
import { useVsBotGameViewModel } from "./useVsBotGameViewModel";
import { useVsBotGameClock } from "./useVsBotGameClock";
import { useVsBotClockTick } from "./useVsBotClockTick";
import { BOT_LEVEL_BY_KEY } from "./bot-levels";
import { useAuthStore } from "../auth/useAuthStore";
import { Board } from "../../components/game/Board";
import { Clock } from "../../components/game/Clock";
import { MoveHistory } from "../../components/game/MoveHistory";
import { PromotionDialog } from "../../components/game/PromotionDialog";
import { GameActions } from "../../components/game/GameActions";
import { ConfirmResignDialog } from "../../components/game/ConfirmResignDialog";
import { VsBotResultModal } from "./VsBotResultModal";

function PlayerCard({
  nickname,
  subtitle,
}: {
  nickname: string;
  subtitle?: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="inline-block w-2 h-2 rounded-full bg-green-500" aria-label="online" />
      <span className="text-text-primary font-semibold truncate">{nickname}</span>
      {subtitle !== undefined && (
        <span className="text-text-muted text-sm tabular-nums">{subtitle}</span>
      )}
    </div>
  );
}

export function VsBotBoard(): JSX.Element {
  const vm = useVsBotGameViewModel();
  const level = useVsBotStore((s) => s.setup.level);
  const rematch = useVsBotStore((s) => s.rematch);
  const user = useAuthStore((s) => s.user);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const tickingClocks = useVsBotGameClock();
  useVsBotClockTick();

  useEffect(() => {
    if (!vm?.canInteract) setSelectedSquare(null);
  }, [vm?.canInteract, vm?.fen]);

  if (vm === null) {
    return <div className="text-text-muted text-center py-10">Loading game...</div>;
  }

  const botConfig = BOT_LEVEL_BY_KEY[level];
  const botName = `Bot ${botConfig.label}`;
  const botSubtitle = `${botConfig.elo} ELO`;
  const selfNickname = user?.nickname ?? "Guest";

  const orientation = vm.boardOrientation;
  const topMs = orientation === "white" ? tickingClocks.blackMs : tickingClocks.whiteMs;
  const bottomMs = orientation === "white" ? tickingClocks.whiteMs : tickingClocks.blackMs;
  const topIsActive = orientation === "white" ? vm.sideToMove === "black" : vm.sideToMove === "white";
  const bottomIsActive = orientation === "white" ? vm.sideToMove === "white" : vm.sideToMove === "black";

  const promotingColor: "w" | "b" = vm.sideToMove === "white" ? "w" : "b";

  function handleSelectSquare(sq: string): void {
    setSelectedSquare(sq || null);
    vm?.onSelectSquare(sq);
  }

  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-6">
      <div className="flex flex-col items-center w-full max-w-[560px] mx-auto gap-2">
        <PlayerCard nickname={botName} subtitle={botSubtitle} />
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

        <Clock ms={bottomMs} isActive={bottomIsActive} />
        <PlayerCard nickname={selfNickname} />

        <GameActions
          canAct={vm.result === null}
          onResignClick={vm.onResignClick}
          onOfferDraw={vm.onOfferDraw}
          showDrawOffer={false}
        />
      </div>

      <section className="flex flex-col gap-2 w-full md:w-auto" aria-labelledby="vs-bot-moves-heading">
        <h2 id="vs-bot-moves-heading" className="text-sm text-text-secondary px-1">Moves</h2>
        <MoveHistory movesSan={vm.movesSan} />
      </section>

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
      {vm.result !== null && !vm.resultModalDismissed && vm.boardOrientation !== undefined && (
        <VsBotResultModal
          result={vm.result}
          resultModalDismissed={vm.resultModalDismissed}
          playerColor={vm.boardOrientation}
          movesSan={vm.movesSan}
          onDismiss={vm.onDismissResult}
          onNewGame={vm.onNewGame}
          onRematch={rematch}
        />
      )}
    </div>
  );
}
