import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TokenVerifierService } from "../auth/token-verifier.service";
import { FriendsController } from "./friends.controller";
import { FriendsService } from "./friends.service";
import { FriendsGateway } from "./friends.gateway";
import { ChallengeService } from "./challenge.service";
import { ChallengeExpirySweeper } from "./challenge-expiry.sweeper";
import { GameModule } from "../game/game.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [PrismaModule, RealtimeModule, GameModule],
  controllers: [FriendsController],
  providers: [
    FriendsService,
    FriendsGateway,
    JwtAuthGuard,
    TokenVerifierService,
    ChallengeService,
    ChallengeExpirySweeper,
  ],
  exports: [FriendsGateway, ChallengeService],
})
export class FriendsModule {}
