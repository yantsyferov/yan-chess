import { Injectable, Logger } from "@nestjs/common";
import { Mode, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Classical ELO. K=32 while gamesPlayed<30, K=16 after. Asymmetric K is allowed.
   * Writes new rating + increments gamesPlayed inside the given Prisma transaction client.
   * Returns deltas and new ratings for broadcasting to the result modal.
   */
  async applyGameResult(args: {
    whiteUserId: string;
    blackUserId: string;
    mode: Mode;
    result: "white_win" | "black_win" | "draw";
    isRated?: boolean;
    tx?: Prisma.TransactionClient;
  }): Promise<{
    whiteBefore: number;
    whiteAfter: number;
    whiteDelta: number;
    blackBefore: number;
    blackAfter: number;
    blackDelta: number;
  }> {
    if (args.isRated === false) {
      const client = args.tx ?? this.prisma;
      const rows = await client.ratingByMode.findMany({
        where: { userId: { in: [args.whiteUserId, args.blackUserId] }, mode: args.mode },
      });
      const white = rows.find((r) => r.userId === args.whiteUserId);
      const black = rows.find((r) => r.userId === args.blackUserId);
      const whiteCurrent = white?.rating ?? 1500;
      const blackCurrent = black?.rating ?? 1500;
      this.logger.log(`Skipping rating update for unrated game (no gameId context)`);
      return {
        whiteBefore: whiteCurrent,
        whiteAfter: whiteCurrent,
        whiteDelta: 0,
        blackBefore: blackCurrent,
        blackAfter: blackCurrent,
        blackDelta: 0,
      };
    }

    const client = args.tx ?? this.prisma;
    const rows = await client.ratingByMode.findMany({
      where: { userId: { in: [args.whiteUserId, args.blackUserId] }, mode: args.mode },
    });
    const white = rows.find((r) => r.userId === args.whiteUserId);
    const black = rows.find((r) => r.userId === args.blackUserId);
    if (!white || !black)
      throw new Error("RatingByMode row missing — login flow should have created these");

    const Kw = white.gamesPlayed < 30 ? 32 : 16;
    const Kb = black.gamesPlayed < 30 ? 32 : 16;
    const expectedW = 1 / (1 + Math.pow(10, (black.rating - white.rating) / 400));
    const expectedB = 1 - expectedW;
    const scoreW = args.result === "white_win" ? 1 : args.result === "draw" ? 0.5 : 0;
    const scoreB = 1 - scoreW;
    const newW = Math.round(white.rating + Kw * (scoreW - expectedW));
    const newB = Math.round(black.rating + Kb * (scoreB - expectedB));

    await client.ratingByMode.update({
      where: { userId_mode: { userId: args.whiteUserId, mode: args.mode } },
      data: { rating: newW, gamesPlayed: { increment: 1 } },
    });
    await client.ratingByMode.update({
      where: { userId_mode: { userId: args.blackUserId, mode: args.mode } },
      data: { rating: newB, gamesPlayed: { increment: 1 } },
    });

    return {
      whiteBefore: white.rating,
      whiteAfter: newW,
      whiteDelta: newW - white.rating,
      blackBefore: black.rating,
      blackAfter: newB,
      blackDelta: newB - black.rating,
    };
  }
}
