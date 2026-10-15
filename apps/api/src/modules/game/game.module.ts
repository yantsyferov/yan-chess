import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RatingModule } from "../rating/rating.module";
import { RedisModule } from "../redis/redis.module";
import { WsExceptionFilter } from "./filters/ws-exception.filter";
import { GameGateway } from "./game.gateway";
import { GameRepository } from "./game.repository";
import { GameService } from "./game.service";
import { ChessRulesService } from "./chess-rules.service";
import { ClockService } from "./clock.service";
import { FlagSweepWorker } from "./flag-sweep.worker";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    AuthModule,
    RedisModule,
    PrismaModule,
    RatingModule,
    RealtimeModule,
  ],
  providers: [
    GameGateway,
    GameRepository,
    GameService,
    ChessRulesService,
    ClockService,
    FlagSweepWorker,
    { provide: APP_FILTER, useClass: WsExceptionFilter },
  ],
  exports: [GameRepository, GameService, GameGateway, ChessRulesService, ClockService],
})
export class GameModule {}
