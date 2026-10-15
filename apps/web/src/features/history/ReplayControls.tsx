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
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === totalMoves;

  return (
    <div className="flex items-center justify-center gap-1" aria-label="Replay controls">
      <IconButton
        label="First move"
        size="md"
        onClick={onFirst}
        disabled={atStart}
      >
        <SkipBack size={18} />
      </IconButton>

      <IconButton
        label="Previous move"
        size="md"
        onClick={onPrev}
        disabled={atStart}
      >
        <ChevronLeft size={18} />
      </IconButton>

      <IconButton
        label={isPlaying ? "Pause" : "Play"}
        size="md"
        onClick={onTogglePlay}
        disabled={onTogglePlay === undefined}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </IconButton>

      <IconButton
        label="Next move"
        size="md"
        onClick={onNext}
        disabled={atEnd}
      >
        <ChevronRight size={18} />
      </IconButton>

      <IconButton
        label="Last move"
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
          <option value={1000}>1 s/move</option>
          <option value={2000}>2 s/move</option>
          <option value={3000}>3 s/move</option>
        </select>
      )}
    </div>
  );
}
