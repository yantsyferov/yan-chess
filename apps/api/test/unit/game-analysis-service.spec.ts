// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GameAnalysisService } from "../../src/modules/game-analysis/game-analysis.service.js";
import type { WriteAnalysisMoveBody, FinalizeAnalysisBody } from "@yanchess/shared";

// ── Fake Prisma builder ──────────────────────────────────────────────────────

const ALICE_ID = "user-alice";
const BOB_ID = "user-bob";
const CHARLIE_ID = "user-charlie";
const GAME_ID = "game-001";
const ANALYSIS_ID = "analysis-001";

function makeGameRow(overrides: Partial<{ whiteUserId: string; blackUserId: string }> = {}) {
  return {
    id: GAME_ID,
    whiteUserId: ALICE_ID,
    blackUserId: BOB_ID,
    ...overrides,
  };
}

function makeAnalysisRow(overrides: Partial<{ completedAt: Date | null; moves: unknown[] }> = {}) {
  return {
    id: ANALYSIS_ID,
    gameId: GAME_ID,
    classifierVersion: 1,
    engineDepth: 18,
    completedAt: null,
    createdAt: new Date("2026-10-18T10:00:00Z"),
    moves: [],
    ...overrides,
  };
}

function makeMoveRow(moveIndex: number, overrides: Partial<object> = {}) {
  return {
    id: `move-${moveIndex}`,
    analysisId: ANALYSIS_ID,
    moveIndex,
    playerColor: "white",
    category: "Best",
    evaluationCp: 20,
    mateIn: null,
    bestMoveUci: "e2e4",
    ...overrides,
  };
}

function buildPrisma(overrides: Partial<{
  gameFindUnique: unknown;
  analysisFindUnique: unknown;
  analysisUpsert: unknown;
  analysisUpdate: unknown;
  moveUpsert: unknown;
}> = {}) {
  return {
    game: {
      findUnique: vi.fn().mockResolvedValue(
        'gameFindUnique' in overrides ? overrides.gameFindUnique : makeGameRow(),
      ),
    },
    gameAnalysis: {
      findUnique: vi.fn().mockResolvedValue(
        'analysisFindUnique' in overrides ? overrides.analysisFindUnique : makeAnalysisRow(),
      ),
      upsert: vi.fn().mockResolvedValue(overrides.analysisUpsert ?? makeAnalysisRow()),
      update: vi.fn().mockResolvedValue(overrides.analysisUpdate ?? makeAnalysisRow({ completedAt: new Date() })),
    },
    gameAnalysisMove: {
      upsert: vi.fn().mockResolvedValue(overrides.moveUpsert ?? makeMoveRow(0)),
    },
  } as never;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GameAnalysisService", () => {
  describe("getAnalysis", () => {
    it("participant (alice) → returns mapped AnalysisResponse", async () => {
      const moves = [
        makeMoveRow(0, { playerColor: "white", category: "Best", evaluationCp: 20, mateIn: null, bestMoveUci: "e2e4" }),
        makeMoveRow(1, { playerColor: "black", category: "Blunder", evaluationCp: -300, mateIn: null, bestMoveUci: "d7d5" }),
      ];
      const prisma = buildPrisma({
        analysisFindUnique: makeAnalysisRow({
          completedAt: new Date("2026-10-18T11:00:00Z"),
          moves,
        }),
      });
      const service = new GameAnalysisService(prisma);

      const result = await service.getAnalysis(GAME_ID, ALICE_ID);

      expect(result.gameId).toBe(GAME_ID);
      expect(result.classifierVersion).toBe(1);
      expect(result.engineDepth).toBe(18);
      expect(result.completedAt).toBe("2026-10-18T11:00:00.000Z");
      expect(result.moves).toHaveLength(2);
      expect(result.moves[0]).toMatchObject({ moveIndex: 0, playerColor: "white", category: "Best" });
      expect(result.moves[1]).toMatchObject({ moveIndex: 1, playerColor: "black", category: "Blunder" });
    });

    it("stranger (charlie) → throws ForbiddenException", async () => {
      const prisma = buildPrisma();
      const service = new GameAnalysisService(prisma);

      await expect(service.getAnalysis(GAME_ID, CHARLIE_ID)).rejects.toThrow(ForbiddenException);
    });

    it("non-existent game → throws NotFoundException", async () => {
      const prisma = buildPrisma({ gameFindUnique: null });
      const service = new GameAnalysisService(prisma);

      await expect(service.getAnalysis("no-such-game", ALICE_ID)).rejects.toThrow(NotFoundException);
    });

    it("no analysis record → throws NotFoundException with ANALYSIS_NOT_FOUND", async () => {
      const prisma = buildPrisma({ analysisFindUnique: null });
      const service = new GameAnalysisService(prisma);

      await expect(service.getAnalysis(GAME_ID, ALICE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("upsertMove", () => {
    it("idempotent: same gameId+index twice → upsert called twice, second call overwrites fields", async () => {
      const prisma = buildPrisma();
      const service = new GameAnalysisService(prisma);

      const body: WriteAnalysisMoveBody = {
        playerColor: "white",
        category: "Best",
        evaluationCp: 10,
        mateIn: null,
        bestMoveUci: "e2e4",
        classifierVersion: 1,
        engineDepth: 18,
      };

      await service.upsertMove(GAME_ID, ALICE_ID, 0, body);
      await service.upsertMove(GAME_ID, ALICE_ID, 0, { ...body, evaluationCp: 50, category: "Good" });

      expect(prisma.gameAnalysisMove.upsert).toHaveBeenCalledTimes(2);
      const secondCall = (prisma.gameAnalysisMove.upsert as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(secondCall.update.evaluationCp).toBe(50);
      expect(secondCall.update.category).toBe("Good");
    });
  });

  describe("finalizeAnalysis", () => {
    it("stamps completedAt and updates metadata", async () => {
      const prisma = buildPrisma();
      const service = new GameAnalysisService(prisma);

      const body: FinalizeAnalysisBody = { classifierVersion: 1, engineDepth: 18 };
      await service.finalizeAnalysis(GAME_ID, ALICE_ID, body);

      expect(prisma.gameAnalysis.update).toHaveBeenCalledOnce();
      const updateCall = (prisma.gameAnalysis.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.where).toEqual({ gameId: GAME_ID });
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.classifierVersion).toBe(1);
      expect(updateCall.data.engineDepth).toBe(18);
    });
  });
});
