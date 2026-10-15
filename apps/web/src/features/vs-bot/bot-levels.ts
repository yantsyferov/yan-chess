export type BotLevel = "beginner" | "amateur" | "clubPlayer" | "strong" | "expert";

export interface BotLevelConfig {
  readonly key: BotLevel;
  readonly label: string;
  readonly elo: number;
  readonly description: string;
}

export const BOT_LEVELS: readonly BotLevelConfig[] = [
  { key: "beginner",   label: "Beginner",     elo: 800,  description: "Just learning the rules" },
  { key: "amateur",    label: "Amateur",      elo: 1200, description: "Plays casually, knows the basics" },
  { key: "clubPlayer", label: "Club Player",  elo: 1500, description: "Average active player" },
  { key: "strong",     label: "Strong",       elo: 1800, description: "Experienced club player" },
  { key: "expert",     label: "Expert",       elo: 2100, description: "Candidate master" },
] as const;

export const BOT_LEVEL_BY_KEY: Readonly<Record<BotLevel, BotLevelConfig>> =
  Object.fromEntries(BOT_LEVELS.map((l) => [l.key, l])) as Record<BotLevel, BotLevelConfig>;
