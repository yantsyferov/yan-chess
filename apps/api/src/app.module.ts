import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { RedisModule } from "./modules/redis/redis.module";
import { RateLimiterModule } from "./modules/rate-limiter/rate-limiter.module";
import { AuthModule } from "./modules/auth/auth.module";
import { MailModule } from "./modules/mail/mail.module";
import { TokensModule } from "./modules/tokens/tokens.module";
import { UsersModule } from "./modules/users/users.module";
import { GameModule } from "./modules/game/game.module";
import { MatchmakingModule } from "./modules/matchmaking/matchmaking.module";
import { RatingModule } from "./modules/rating/rating.module";
import { GameHistoryModule } from "./modules/game-history/game-history.module";
import { FriendsModule } from "./modules/friends/friends.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";

@Module({
  imports: [ScheduleModule.forRoot(), HealthModule, PrismaModule, RedisModule, RateLimiterModule, MailModule, TokensModule, AuthModule, UsersModule, RealtimeModule, GameModule, MatchmakingModule, RatingModule, GameHistoryModule, FriendsModule],
})
export class AppModule {}
