import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import type { AnalysisResponse, FinalizeAnalysisBody, WriteAnalysisMoveBody } from "@yanchess/shared";
import { finalizeAnalysisSchema, writeAnalysisMoveSchema } from "@yanchess/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, type JwtPayload } from "../auth/guards/jwt-auth.guard";
import { GameAnalysisService } from "./game-analysis.service";

@Controller()
export class GameAnalysisController {
  constructor(private readonly gameAnalysisService: GameAnalysisService) {}

  @Get("games/:gameId/analysis")
  @UseGuards(JwtAuthGuard)
  async getAnalysis(
    @Req() req: Request & { user: JwtPayload },
    @Param("gameId") gameId: string,
  ): Promise<AnalysisResponse> {
    return this.gameAnalysisService.getAnalysis(gameId, req.user.sub);
  }

  @Put("games/:gameId/analysis/moves/:index")
  @UseGuards(JwtAuthGuard)
  async upsertMove(
    @Req() req: Request & { user: JwtPayload },
    @Param("gameId") gameId: string,
    @Param("index") index: string,
    @Body(new ZodValidationPipe(writeAnalysisMoveSchema)) body: WriteAnalysisMoveBody,
  ): Promise<{ ok: true }> {
    await this.gameAnalysisService.upsertMove(gameId, req.user.sub, parseInt(index, 10), body);
    return { ok: true };
  }

  @Post("games/:gameId/analysis/finalize")
  @UseGuards(JwtAuthGuard)
  async finalizeAnalysis(
    @Req() req: Request & { user: JwtPayload },
    @Param("gameId") gameId: string,
    @Body(new ZodValidationPipe(finalizeAnalysisSchema)) body: FinalizeAnalysisBody,
  ): Promise<{ ok: true }> {
    await this.gameAnalysisService.finalizeAnalysis(gameId, req.user.sub, body);
    return { ok: true };
  }
}
