import { Injectable } from "@nestjs/common";
import { Game, GameEndReason, GameResult, Mode, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateCompletedGameInput {
  mode: Mode;
  timeControlMs: number;
  whiteUserId: string;
  blackUserId: string;
  result: GameResult;
  endReason: GameEndReason;
  pgn: string;
  finalFen: string;
  whiteRatingBefore: number;
  whiteRatingAfter: number;
  blackRatingBefore: number;
  blackRatingAfter: number;
  startedAt: Date;
  endedAt: Date;
}

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCompletedGame(
    input: CreateCompletedGameInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Game> {
    const client = tx ?? this.prisma;
    return client.game.create({ data: input });
  }

  async findById(id: string): Promise<Game | null> {
    return this.prisma.game.findUnique({ where: { id } });
  }
}
