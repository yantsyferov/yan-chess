import { Zap, Flame, Clock, Hourglass, Sparkles, BookOpen, Users, Swords, Trophy, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Mode } from "@yanchess/shared";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { BOT_LEVELS } from "./bot-levels";
import type { BotLevel } from "./bot-levels";
import { useVsBotStore } from "./useVsBotStore";
import { MODE_LABELS } from "../shared/mode-labels";

// ── Mode options ──────────────────────────────────────────────────────────────

const TIME_LABELS: Record<Mode, string> = {
  Bullet: "1 min",
  Blitz: "3 min",
  Rapid: "10 min",
  Classical: "30 min",
};

interface ModeOption {
  readonly mode: Mode;
  readonly Icon: LucideIcon;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  { mode: "Bullet", Icon: Zap },
  { mode: "Blitz", Icon: Flame },
  { mode: "Rapid", Icon: Clock },
  { mode: "Classical", Icon: Hourglass },
] as const;

// ── Level icons ───────────────────────────────────────────────────────────────

const LEVEL_ICONS: Record<BotLevel, LucideIcon> = {
  beginner: Sparkles,
  amateur: BookOpen,
  clubPlayer: Users,
  strong: Swords,
  expert: Trophy,
};

// ── Color options ─────────────────────────────────────────────────────────────

type ColorOption = "white" | "black" | "random";

const COLOR_LABELS: Record<ColorOption, string> = {
  white: "White",
  black: "Black",
  random: "Random",
};

const COLOR_OPTIONS: readonly ColorOption[] = ["white", "black", "random"] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function VsBotSetup({ engineReady = false }: { engineReady?: boolean } = {}): JSX.Element {
  const level = useVsBotStore((s) => s.setup.level);
  const color = useVsBotStore((s) => s.setup.color);
  const mode = useVsBotStore((s) => s.setup.mode);
  const setLevel = useVsBotStore((s) => s.setLevel);
  const setColor = useVsBotStore((s) => s.setColor);
  const setMode = useVsBotStore((s) => s.setMode);
  const startGame = useVsBotStore((s) => s.startGame);

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 sm:px-4 sm:py-10 flex flex-col gap-8">
      <h1 className="text-3xl font-semibold text-text-primary text-center">
        Play vs bot
      </h1>

      {/* Group 1 — Level */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-text-primary">Difficulty</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {BOT_LEVELS.map((cfg) => {
            const isActive = level === cfg.key;
            const Icon = LEVEL_ICONS[cfg.key];
            return (
              <button
                key={cfg.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setLevel(cfg.key)}
                className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-xl"
              >
                <Card
                  padding="sm"
                  className={`cursor-pointer transition-all hover:border-accent h-full ${
                    isActive ? "border-accent shadow-glow" : ""
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Icon
                      size={28}
                      className={isActive ? "text-accent" : "text-text-muted"}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-text-primary text-center">
                      {cfg.label}
                    </span>
                    <span className="text-xs text-accent font-medium">{cfg.elo} ELO</span>
                    <span className="text-xs text-text-secondary text-center leading-tight">
                      {cfg.description}
                    </span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      {/* Group 2 — Color */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-text-primary">Color</h2>
        <div className="grid grid-cols-3 gap-3">
          {COLOR_OPTIONS.map((c) => {
            const isActive = color === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={isActive}
                onClick={() => setColor(c)}
                className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-xl"
              >
                <Card
                  padding="sm"
                  className={`cursor-pointer transition-all hover:border-accent ${
                    isActive ? "border-accent shadow-glow" : ""
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 py-2">
                    <span className="text-2xl" aria-hidden>
                      {c === "white" ? "♔" : c === "black" ? "♚" : "🎲"}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {COLOR_LABELS[c]}
                    </span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      {/* Group 3 — Time control */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-text-primary">Time control</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MODE_OPTIONS.map(({ mode: m, Icon }) => {
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
                      {MODE_LABELS[m]}
                    </span>
                    <span className="text-xs text-text-secondary">{TIME_LABELS[m]}</span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col items-center gap-3">
        {!engineReady && (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" aria-hidden />
            Loading engine...
          </span>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={startGame}
          disabled={!engineReady}
        >
          Start game
        </Button>
      </div>
    </div>
  );
}
