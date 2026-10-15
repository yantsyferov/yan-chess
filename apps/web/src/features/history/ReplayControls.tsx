import { useTranslation } from "react-i18next";
import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";

export interface ReplayControlsProps {
  currentIndex: number;
  totalMoves: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  // Slice 6:
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  speed?: number;
  onSpeedChange?: (ms: number) => void;
}

export function ReplayControls({
  currentIndex,
  totalMoves,
  onFirst,
  onPrev,
  onNext,
  onLast,
  isPlaying = false,
  onTogglePlay,
  speed = 2000,
  onSpeedChange,
}: ReplayControlsProps): JSX.Element {
  const { t } = useTranslation("history");
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === totalMoves;

  return (
    <div className="flex items-center justify-center gap-1" aria-label="Replay controls">
      <IconButton
        label={t("replay.first")}
        size="md"
        onClick={onFirst}
        disabled={atStart}
      >
        <SkipBack size={18} />
      </IconButton>

      <IconButton
        label={t("replay.prev")}
        size="md"
        onClick={onPrev}
        disabled={atStart}
      >
        <ChevronLeft size={18} />
      </IconButton>

      <IconButton
        label={isPlaying ? t("replay.pause") : t("replay.autoplay")}
        size="md"
        onClick={onTogglePlay}
        disabled={onTogglePlay === undefined}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </IconButton>

      <IconButton
        label={t("replay.next")}
        size="md"
        onClick={onNext}
        disabled={atEnd}
      >
        <ChevronRight size={18} />
      </IconButton>

      <IconButton
        label={t("replay.last")}
        size="md"
        onClick={onLast}
        disabled={atEnd}
      >
        <SkipForward size={18} />
      </IconButton>

      {onSpeedChange !== undefined && (
        <select
          aria-label="Autoplay speed"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="ml-2 text-sm bg-surface-secondary text-text-primary border border-border rounded px-1 py-0.5"
        >
          <option value={1000}>{t("replay.speed.1s")}</option>
          <option value={2000}>{t("replay.speed.2s")}</option>
          <option value={3000}>{t("replay.speed.3s")}</option>
        </select>
      )}
    </div>
  );
}
