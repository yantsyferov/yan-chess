import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { GameModule } from "../game/game.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { MatchmakingService } from "./matchmaking.service";

@Global()
@Module({
  imports: [RedisModule, PrismaModule, GameModule, RealtimeModule],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
