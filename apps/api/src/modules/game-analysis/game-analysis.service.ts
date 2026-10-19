import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AnalysisMove, AnalysisResponse, FinalizeAnalysisBody, WriteAnalysisMoveBody } from "@yanchess/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GameAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalysis(gameId: string, userId: string): Promise<AnalysisResponse> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException({ error: { code: "GAME_NOT_AVAILABLE" } });
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException({ error: { code: "GAME_NOT_AVAILABLE" } });
    }

    const analysis = await this.prisma.gameAnalysis.findUnique({
      where: { gameId },
      include: { moves: { orderBy: { moveIndex: "asc" } } },
    });
    if (!analysis) throw new NotFoundException({ error: { code: "ANALYSIS_NOT_FOUND" } });

    const moves: AnalysisMove[] = analysis.moves.map((m) => ({
      moveIndex: m.moveIndex,
      playerColor: m.playerColor as "white" | "black",
      category: m.category as AnalysisMove["category"],
      evaluationCp: m.evaluationCp,
      mateIn: m.mateIn,
      bestMoveUci: m.bestMoveUci,
    }));

    return {
      gameId: analysis.gameId,
      classifierVersion: analysis.classifierVersion,
      engineDepth: analysis.engineDepth,
      completedAt: analysis.completedAt ? analysis.completedAt.toISOString() : null,
      moves,
    };
  }

  async upsertMove(
    gameId: string,
    userId: string,
    moveIndex: number,
    body: WriteAnalysisMoveBody,
  ): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException({ error: { code: "GAME_NOT_AVAILABLE" } });
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException({ error: { code: "GAME_NOT_AVAILABLE" } });
    }

    const analysis = await this.prisma.gameAnalysis.upsert({
      where: { gameId },
      create: {
        gameId,
        classifierVersion: body.classifierVersion,
        engineDepth: body.engineDepth,
      },
      update: {},
    });

    await this.prisma.gameAnalysisMove.upsert({
      where: { analysisId_moveIndex: { analysisId: analysis.id, moveIndex } },
      create: {
        analysisId: analysis.id,
        moveIndex,
        playerColor: body.playerColor,
        category: body.category,
        evaluationCp: body.evaluationCp,
        mateIn: body.mateIn,
        bestMoveUci: body.bestMoveUci,
      },
      update: {
        playerColor: body.playerColor,
        category: body.category,
        evaluationCp: body.evaluationCp,
        mateIn: body.mateIn,
        bestMoveUci: body.bestMoveUci,
      },
    });
  }

  async finalizeAnalysis(gameId: string, userId: string, body: FinalizeAnalysisBody): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException({ error: { code: "GAME_NOT_AVAILABLE" } });
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException({ error: { code: "GAME_NOT_AVAILABLE" } });
    }

    await this.prisma.gameAnalysis.update({
      where: { gameId },
      data: {
        completedAt: new Date(),
        classifierVersion: body.classifierVersion,
        engineDepth: body.engineDepth,
      },
    });
  }
}
