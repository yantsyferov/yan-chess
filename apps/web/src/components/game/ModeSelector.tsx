import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useGameStore } from "../../features/game/useGameStore";
import { MODE_LABELS, TIME_LABELS, MODE_OPTIONS } from "../../features/shared/mode-labels";

interface ModeSelectorProps {
  showStartButton?: boolean;
}

export function ModeSelector({ showStartButton = true }: ModeSelectorProps = {}): JSX.Element {
  const { t } = useTranslation("game");
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
        {MODE_OPTIONS.map(({ mode: m, Icon }) => {
          const label = MODE_LABELS[m];
          const time = TIME_LABELS[m];
          const isActive = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={isActive}
              onClick={() => setMode(m)}
              className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-xl"
            >
              <Card
                padding="sm"
                className={`cursor-pointer transition-all hover:border-accent ${
                  isActive ? "border-accent shadow-glow" : ""
                }`}
              >
                <div className="flex flex-col items-center gap-2 py-2">
                  <Icon
                    size={28}
                    className={isActive ? "text-accent" : "text-text-muted"}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                  <span className="text-xs text-text-secondary">{time}</span>
                </div>
              </Card>
            </button>
          );
        })}
      </div>
      {showStartButton && (
        <Button variant="primary" size="lg" onClick={startGame}>
          {t("board.startGame")}
        </Button>
      )}
    </div>
  );
}
