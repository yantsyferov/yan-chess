import { Controller, Get, Param, Query, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import type { GameListResponse, GameReplayResponse } from "@yanchess/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, type JwtPayload } from "../auth/guards/jwt-auth.guard";
import { GameHistoryService } from "./game-history.service";
import { getGameHistoryQuerySchema, type GetGameHistoryQuery } from "./dto/get-game-history-query.dto";

@Controller()
export class GameHistoryController {
  constructor(private readonly gameHistoryService: GameHistoryService) {}

  @Get("users/me/games")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(getGameHistoryQuerySchema))
  async listGames(
    @Req() req: Request & { user: JwtPayload },
    @Query() query: GetGameHistoryQuery,
  ): Promise<GameListResponse> {
    return this.gameHistoryService.listGames(req.user.sub, {
      page: query.page,
      mode: query.mode,
      result: query.result,
    });
  }

  @Get("games/:gameId")
  @UseGuards(JwtAuthGuard)
  async getGame(
    @Req() req: Request & { user: JwtPayload },
    @Param("gameId") gameId: string,
  ): Promise<GameReplayResponse> {
    return this.gameHistoryService.getGameById(req.user.sub, gameId);
  }
}
