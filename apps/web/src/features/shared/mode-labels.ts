import type { Mode } from "@yanchess/shared";

export const MODE_LABELS: Record<Mode, string> = {
  Bullet: "Bullet",
  Blitz: "Blitz",
  Rapid: "Rapid",
  Classical: "Classical",
};

export const TIME_CONTROL_MS: Record<Mode, number> = {
  Bullet: 60_000,
  Blitz: 180_000,
  Rapid: 600_000,
  Classical: 1_800_000,
};
