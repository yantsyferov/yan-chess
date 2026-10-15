import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GameResult } from "@prisma/client";
import type { GameListItem, GameListResponse, GameReplayResponse } from "@yanchess/shared";
import { PrismaService } from "../prisma/prisma.service";

const PER_PAGE = 20;

type GameWithUsers = {
  id: string;
  mode: string;
  whiteUserId: string;
  blackUserId: string;
  result: GameResult;
  endReason: string;
  whiteRatingBefore: number;
  whiteRatingAfter: number;
  blackRatingBefore: number;
  blackRatingAfter: number;
  startedAt: Date;
  endedAt: Date;
  whiteUser: { nickname: string };
  blackUser: { nickname: string };
};

type ListWhereArgs = {
  mode?: string;
  result?: "wins" | "losses" | "draws";
};

export function buildListWhere(userId: string, { mode, result }: ListWhereArgs): object {
  const baseParticipant = { OR: [{ whiteUserId: userId }, { blackUserId: userId }] };

  let where: object;
  if (result === "wins") {
    where = { OR: [{ whiteUserId: userId, result: "white_win" }, { blackUserId: userId, result: "black_win" }] };
  } else if (result === "losses") {
    where = { OR: [{ whiteUserId: userId, result: "black_win" }, { blackUserId: userId, result: "white_win" }] };
  } else if (result === "draws") {
    where = { AND: [baseParticipant, { result: "draw" }] };
  } else {
    where = baseParticipant;
  }

  if (mode !== undefined) {
    where = { AND: [where, { mode }] };
  }

  return where;
}

@Injectable()
export class GameHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listGames(
    userId: string,
    args: { page: number; mode?: string; result?: "wins" | "losses" | "draws" },
  ): Promise<GameListResponse> {
    const { page, mode, result } = args;

    const where = buildListWhere(userId, { mode, result });

    const totalGames = await this.prisma.game.count({ where });

    const totalPages = Math.max(1, Math.ceil(totalGames / PER_PAGE));
    const effectivePage = Math.min(Math.max(page, 1), totalPages);

    const games = await this.prisma.game.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (effectivePage - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        whiteUser: { select: { nickname: true } },
        blackUser: { select: { nickname: true } },
      },
    });

    const items = games.map((game) => this.mapToListItem(game as GameWithUsers, userId));

    return {
      games: items,
      pagination: { page: effectivePage, perPage: PER_PAGE, totalGames, totalPages },
    };
  }

  async getGameById(userId: string, gameId: string): Promise<GameReplayResponse> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whiteUser: { select: { id: true, nickname: true } },
        blackUser: { select: { id: true, nickname: true } },
      },
    });
    if (!game) throw new NotFoundException({ error: { code: "GAME_NOT_AVAILABLE" } });
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException({ error: { code: "GAME_NOT_AVAILABLE" } });
    }
    return {
      gameId: game.id,
      mode: game.mode as GameReplayResponse["mode"],
      timeControlMs: game.timeControlMs,
      pgn: game.pgn,
      finalFen: game.finalFen,
      white: {
        userId: game.whiteUserId,
        nickname: game.whiteUser.nickname,
        ratingBefore: game.whiteRatingBefore,
        ratingAfter: game.whiteRatingAfter,
      },
      black: {
        userId: game.blackUserId,
        nickname: game.blackUser.nickname,
        ratingBefore: game.blackRatingBefore,
        ratingAfter: game.blackRatingAfter,
      },
      result: game.result as GameReplayResponse["result"],
      endReason: game.endReason as GameReplayResponse["endReason"],
      startedAt: game.startedAt.toISOString(),
      endedAt: game.endedAt.toISOString(),
    };
  }

  mapToListItem(game: GameWithUsers, userId: string): GameListItem {
    const playerColor = game.whiteUserId === userId ? "white" : "black";

    const opponent = {
      nickname: playerColor === "white" ? game.blackUser.nickname : game.whiteUser.nickname,
      ratingAfter: playerColor === "white" ? game.blackRatingAfter : game.whiteRatingAfter,
    };

    let result: "win" | "loss" | "draw";
    if (game.result === "draw") {
      result = "draw";
    } else if (
      (game.result === "white_win" && playerColor === "white") ||
      (game.result === "black_win" && playerColor === "black")
    ) {
      result = "win";
    } else {
      result = "loss";
    }

    const ratingBefore = playerColor === "white" ? game.whiteRatingBefore : game.blackRatingBefore;
    const ratingAfter = playerColor === "white" ? game.whiteRatingAfter : game.blackRatingAfter;

    return {
      gameId: game.id,
      mode: game.mode as GameListItem["mode"],
      playerColor,
      opponent,
      result,
      endReason: game.endReason as GameListItem["endReason"],
      ratingBefore,
      ratingAfter,
      ratingDelta: ratingAfter - ratingBefore,
      startedAt: game.startedAt.toISOString(),
      endedAt: game.endedAt.toISOString(),
    };
  }
}
