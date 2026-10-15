// @layer: unit
// @spec: 006-game-history
import { describe, it, expect } from "vitest";

// ── Pure WHERE helper ────────────────────────────────────────────────────────
// Imported from the service module once it is extracted there.
// For now we import the soon-to-exist named export and rely on the module
// resolution to fail → RED; then pass → GREEN after the change.
import { buildListWhere } from "../../src/modules/game-history/game-history.service.js";

// ── helpers ──────────────────────────────────────────────────────────────────
const USER = "user-abc";

describe("buildListWhere", () => {
  it("1. no filters → baseParticipant only", () => {
    const where = buildListWhere(USER, {});
    expect(where).toEqual({
      OR: [{ whiteUserId: USER }, { blackUserId: USER }],
    });
  });

  it("2. mode only (Blitz) → AND[baseParticipant, {mode}]", () => {
    const where = buildListWhere(USER, { mode: "Blitz" });
    expect(where).toEqual({
      AND: [
        { OR: [{ whiteUserId: USER }, { blackUserId: USER }] },
        { mode: "Blitz" },
      ],
    });
  });

  it("3. result=wins (no mode) → perspective-aware OR", () => {
    const where = buildListWhere(USER, { result: "wins" });
    expect(where).toEqual({
      OR: [
        { whiteUserId: USER, result: "white_win" },
        { blackUserId: USER, result: "black_win" },
      ],
    });
  });

  it("4. result=losses → inverse perspective OR", () => {
    const where = buildListWhere(USER, { result: "losses" });
    expect(where).toEqual({
      OR: [
        { whiteUserId: USER, result: "black_win" },
        { blackUserId: USER, result: "white_win" },
      ],
    });
  });

  it("5. result=draws (no mode) → AND[baseParticipant, {result:draw}]", () => {
    const where = buildListWhere(USER, { result: "draws" });
    expect(where).toEqual({
      AND: [
        { OR: [{ whiteUserId: USER }, { blackUserId: USER }] },
        { result: "draw" },
      ],
    });
  });

  it("6. mode=Rapid + result=wins → AND[perspectiveOR, {mode:Rapid}]", () => {
    const where = buildListWhere(USER, { mode: "Rapid", result: "wins" });
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { whiteUserId: USER, result: "white_win" },
            { blackUserId: USER, result: "black_win" },
          ],
        },
        { mode: "Rapid" },
      ],
    });
  });
});
