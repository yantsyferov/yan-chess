import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { RedisService } from "../redis/redis.service";
import { ChessRulesService } from "./chess-rules.service";
import { ClockService } from "./clock.service";
import { GameColor, GameEndReason, GameService } from "./game.service";

@Injectable()
export class FlagSweepWorker {
  constructor(
    private readonly redis: RedisService,
    private readonly chessRules: ChessRulesService,
    private readonly clockService: ClockService,
    private readonly gameService: GameService,
  ) {}

  @Interval(1000)
  async sweep(): Promise<void> {
    const ids = await this.redis.raw.smembers("game:active");
    const now = Date.now();
    for (const id of ids) {
      const hash = await this.redis.raw.hgetall(`game:${id}`);
      if (!hash || hash["status"] === "ended") continue;
      const { flagged } = this.clockService.tickOnMove({
        whiteClockMs: parseInt(hash["whiteClockMs"] ?? "0"),
        blackClockMs: parseInt(hash["blackClockMs"] ?? "0"),
        lastMoveAt: parseInt(hash["lastMoveAt"] ?? "0"),
        sideToMove: hash["sideToMove"] as GameColor,
        now,
      });
      if (flagged !== null) {
        const canMate = this.chessRules.canOpponentMate(hash["fen"] ?? "", flagged);
        const reason: GameEndReason = canMate
          ? "flag"
          : "flag_vs_insufficient_material";
        const winner: GameColor | null = canMate
          ? flagged === "white"
            ? "black"
            : "white"
          : null;
        await this.gameService.endGame(id, { reason, winner });
      }
    }
  }
}
