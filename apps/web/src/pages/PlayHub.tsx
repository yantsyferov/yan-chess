import { Chess } from "chess.js";
import { Globe, Bot, Users, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Board } from "../components/game/Board";
import { ModeCard } from "../features/play/ModeCard";
import { useAuthStore } from "../features/auth/useAuthStore";

const START_FEN = new Chess().fen();

export function PlayHub(): JSX.Element {
  const { t } = useTranslation("game");
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = user !== null;

  return (
    <div className="flex md:flex-row flex-col gap-6 max-w-6xl mx-auto px-4 py-8">
      <div className="md:w-[400px] shrink-0">
        <Board
          fen={START_FEN}
          canInteract={false}
          boardOrientation="white"
          lastMove={null}
          pendingPromotion={null}
          selectedSquare={null}
          onMove={() => {}}
          onSelectSquare={() => {}}
        />
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold mb-2">{t("play.hub.title")}</h1>

        <ModeCard
          icon={Globe}
          titleKey="play.modeCard.online.title"
          descriptionKey="play.modeCard.online.description"
          to="/play/online"
          requiresAuth={true}
          isAuthenticated={isAuthenticated}
        />
        <ModeCard
          icon={Bot}
          titleKey="play.modeCard.ai.title"
          descriptionKey="play.modeCard.ai.description"
          to="/play/ai"
          requiresAuth={false}
          isAuthenticated={isAuthenticated}
        />
        <ModeCard
          icon={Users}
          titleKey="play.modeCard.friend.title"
          descriptionKey="play.modeCard.friend.description"
          to="/play/friend"
          requiresAuth={true}
          isAuthenticated={isAuthenticated}
        />
        <ModeCard
          icon={Monitor}
          titleKey="play.modeCard.hotseat.title"
          descriptionKey="play.modeCard.hotseat.description"
          to="/game"
          requiresAuth={false}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
