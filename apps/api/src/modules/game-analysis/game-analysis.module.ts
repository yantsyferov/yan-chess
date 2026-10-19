import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TokenVerifierService } from "../auth/token-verifier.service";
import { GameAnalysisController } from "./game-analysis.controller";
import { GameAnalysisService } from "./game-analysis.service";

@Module({
  imports: [PrismaModule],
  controllers: [GameAnalysisController],
  providers: [GameAnalysisService, JwtAuthGuard, TokenVerifierService],
})
export class GameAnalysisModule {}
