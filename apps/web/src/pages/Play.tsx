import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../features/auth/useAuthStore";
import { useGameStore } from "../features/game/useGameStore";
import { getSocket } from "../features/online/socket";
import { useMatchmakingStore, wireMatchmakingSocket } from "../features/online/useMatchmakingStore";
import { useOnlineGameStore, wireOnlineGameSocket } from "../features/online/useOnlineGameStore";
import { SearchingPhase } from "../features/online/SearchingPhase";
import { OnlineBoard } from "../features/online/OnlineBoard";
import { ModeSelector } from "../components/game/ModeSelector";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { Mode } from "@yanchess/shared";

interface LocationState {
  mode?: Mode;
}

const VALID_MODES = new Set<Mode>(["Bullet", "Blitz", "Rapid", "Classical"]);

function isMode(value: unknown): value is Mode {
  return typeof value === "string" && VALID_MODES.has(value as Mode);
}

export function Play(): JSX.Element {
  const { t } = useTranslation("common");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const matchmakingPhase = useMatchmakingStore((s) => s.phase);
  const joinQueue = useMatchmakingStore((s) => s.joinQueue);

  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const setMode = useGameStore((s) => s.setMode);
  const selectedMode = useGameStore((s) => s.mode);

  const gameId = useOnlineGameStore((s) => s.gameId);

  // Wire socket listeners once on mount
  useEffect(() => {
    wireMatchmakingSocket();
    wireOnlineGameSocket();
  }, []);

  // Leave queue if user navigates away while searching
  useEffect(() => {
    return (): void => {
      if (useMatchmakingStore.getState().phase === "searching") {
        useMatchmakingStore.getState().leaveQueue();
      }
    };
  }, []);

  // Establish socket connection and track connectivity
  useEffect(() => {
    const sock = getSocket();
    const onConnect = (): void => setIsConnected(true);
    const onDisconnect = (): void => setIsConnected(false);

    // Reflect current state immediately (socket may already be connected)
    setIsConnected(sock.connected);

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);

    return (): void => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      // Do NOT disconnect — socket is a singleton for the tab's lifetime
    };
  }, []);

  // Sync mode from navigation state on mount
  useEffect(() => {
    const modeFromState = locationState?.mode;
    if (isMode(modeFromState)) {
      setMode(modeFromState);
    } else {
      setMode("Blitz");
    }
    // Run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const user = useAuthStore((s) => s.user);
  const ratingEntry = user?.ratings?.find((r) => r.mode === selectedMode);
  const displayRating = ratingEntry?.rating ?? 1500;

  if (gameId !== null) {
    return (
      <div className="max-w-4xl mx-auto px-3 py-6 sm:px-4 sm:py-10">
        <OnlineBoard />
      </div>
    );
  }

  if (matchmakingPhase === "searching") {
    return <SearchingPhase />;
  }

  if (matchmakingPhase === "idle") {
    return (
      <div className="max-w-2xl mx-auto px-3 py-6 sm:px-4 sm:py-10 flex flex-col gap-6">
        {isConnected && (
          <div className="fixed top-3 right-3 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-text-muted text-xs">{t("play.connectionEstablished")}</span>
          </div>
        )}
        <h1 className="text-3xl font-semibold text-text-primary">{t("play.title")}</h1>

        <Card variant="glass" padding="lg">
          <ModeSelector showStartButton={false} />
        </Card>

        <Card variant="glass" padding="md">
          <p className="text-text-secondary text-sm text-center">
            {t("play.yourRating")}{" "}
            <span className="text-text-primary font-semibold">{displayRating}</span>
          </p>
        </Card>

        <div className="flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (selectedMode !== null) {
                joinQueue(selectedMode);
              }
            }}
          >
            {t("play.findGame")}
          </Button>
        </div>
      </div>
    );
  }

  return <></>;
}
