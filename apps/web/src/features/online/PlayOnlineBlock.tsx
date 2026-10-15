import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Zap, Flame, Clock, Hourglass } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Mode } from "@yanchess/shared";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../auth/useAuthStore";
import { useGameStore } from "../game/useGameStore";
import { MODE_LABELS } from "../shared/mode-labels";

const TIME_LABELS: Record<Mode, string> = {
  Bullet: "1 min",
  Blitz: "3 min",
  Rapid: "10 min",
  Classical: "30 min",
};

interface ModeOption {
  mode: Mode;
  Icon: LucideIcon;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  { mode: "Bullet", Icon: Zap },
  { mode: "Blitz", Icon: Flame },
  { mode: "Rapid", Icon: Clock },
  { mode: "Classical", Icon: Hourglass },
] as const;

const DEFAULT_RATING = 1500;

export function PlayOnlineBlock(): JSX.Element {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);

  const didInitDefault = useRef(false);
  useEffect(() => {
    if (!didInitDefault.current) {
      didInitDefault.current = true;
      setMode("Blitz");
    }
  }, [setMode]);

  const rating =
    user?.ratings?.find((r) => r.mode === mode)?.rating ?? DEFAULT_RATING;

  function handleFindGame(): void {
    if (user) {
      navigate("/play", { state: { mode } });
    } else {
      navigate("/login", {
        state: { message: "Sign in to play online", returnTo: "/" },
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold text-text-primary text-center">
        {t("play.title")}
      </h2>

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
                  <span className="text-sm font-semibold text-text-primary">
                    {label}
                  </span>
                  <span className="text-xs text-text-secondary">{time}</span>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      <p className="text-center text-text-secondary text-sm">
        {t("play.yourRating")} <span className="font-semibold text-text-primary">{rating}</span>
      </p>

      <div className="flex justify-center">
        <Button variant="primary" size="lg" onClick={handleFindGame}>
          {t("play.findGame")}
        </Button>
      </div>
    </div>
  );
}
