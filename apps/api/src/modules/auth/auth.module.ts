import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenVerifierService } from "./token-verifier.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, TokenVerifierService],
  exports: [TokenVerifierService],
})
export class AuthModule {}
