// @layer: unit
// @spec: 005-play-vs-bot
// @regression

import { describe, it, expect } from "vitest";
import { BOT_LEVELS, BOT_LEVEL_BY_KEY } from "../bot-levels";
import type { BotLevel } from "../bot-levels";

describe("BOT_LEVELS", () => {
  it("has exactly 5 levels", () => {
    // @regression
    expect(BOT_LEVELS).toHaveLength(5);
  });

  it("all level keys are unique", () => {
    // @regression
    const keys = BOT_LEVELS.map((l) => l.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(5);
  });

  it("all labels are non-empty strings", () => {
    // @regression
    for (const level of BOT_LEVELS) {
      expect(typeof level.label).toBe("string");
      expect(level.label.length).toBeGreaterThan(0);
    }
  });

  it("ELO targets match spec: 800, 1200, 1500, 1800, 2100", () => {
    // @regression
    const expectedElos: Record<BotLevel, number> = {
      beginner: 800,
      amateur: 1200,
      clubPlayer: 1500,
      strong: 1800,
      expert: 2100,
    };
    for (const level of BOT_LEVELS) {
      expect(level.elo).toBe(expectedElos[level.key]);
    }
  });

  it("BOT_LEVEL_BY_KEY indexes all 5 levels", () => {
    const keys: BotLevel[] = ["beginner", "amateur", "clubPlayer", "strong", "expert"];
    for (const key of keys) {
      expect(BOT_LEVEL_BY_KEY[key]).toBeDefined();
      expect(BOT_LEVEL_BY_KEY[key].key).toBe(key);
    }
  });

  it("negative: a non-existent key is not present in BOT_LEVEL_BY_KEY", () => {
    expect((BOT_LEVEL_BY_KEY as Record<string, unknown>)["grandmaster"]).toBeUndefined();
  });
});
