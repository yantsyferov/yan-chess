import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { useSessionAnalysisStore } from "./useSessionAnalysisStore";

export type GameRef =
  | { kind: "online"; gameId: string }
  | {
      kind: "session";
      source: "vs-bot" | "hotseat";
      pgn: string;
      playerColor: "white" | "black";
    };

interface AnalyzeButtonProps {
  gameRef: GameRef;
}

export function AnalyzeButton({ gameRef }: AnalyzeButtonProps): JSX.Element {
  const { t } = useTranslation("analysis");
  const navigate = useNavigate();

  function handleClick(): void {
    if (gameRef.kind === "online") {
      navigate(`/analysis/${gameRef.gameId}`);
    } else {
      useSessionAnalysisStore.getState().set({
        pgn: gameRef.pgn,
        playerColor: gameRef.playerColor,
        source: gameRef.source,
      });
      navigate("/analysis/session");
    }
  }

  return (
    <Button variant="secondary" size="md" onClick={handleClick}>
      {t("buttons.analyze")}
    </Button>
  );
}
