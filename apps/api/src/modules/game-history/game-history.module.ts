import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TokenVerifierService } from "../auth/token-verifier.service";
import { GameHistoryController } from "./game-history.controller";
import { GameHistoryService } from "./game-history.service";

@Module({
  imports: [PrismaModule],
  controllers: [GameHistoryController],
  providers: [GameHistoryService, JwtAuthGuard, TokenVerifierService],
})
export class GameHistoryModule {}
