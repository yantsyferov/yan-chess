import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TokenVerifierService } from "../auth/token-verifier.service";

@Module({ controllers: [UsersController], providers: [UsersService, JwtAuthGuard, TokenVerifierService], exports: [UsersService] })
export class UsersModule {}
