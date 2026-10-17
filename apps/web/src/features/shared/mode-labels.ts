import { Zap, Flame, Clock, Hourglass } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Mode } from "@yanchess/shared";

export const MODE_LABELS: Record<Mode, string> = {
  Bullet: "Bullet",
  Blitz: "Blitz",
  Rapid: "Rapid",
  Classical: "Classical",
};

export const TIME_LABELS: Record<Mode, string> = {
  Bullet: "1 min",
  Blitz: "3 min",
  Rapid: "10 min",
  Classical: "30 min",
};

export const TIME_CONTROL_MS: Record<Mode, number> = {
  Bullet: 60_000,
  Blitz: 180_000,
  Rapid: 600_000,
  Classical: 1_800_000,
};

interface ModeOption {
  readonly mode: Mode;
  readonly Icon: LucideIcon;
}

export const MODE_OPTIONS: readonly ModeOption[] = [
  { mode: "Bullet", Icon: Zap },
  { mode: "Blitz", Icon: Flame },
  { mode: "Rapid", Icon: Clock },
  { mode: "Classical", Icon: Hourglass },
] as const;
