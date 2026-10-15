import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard, type JwtPayload } from "../auth/guards/jwt-auth.guard";
import { UsersService, type UserMeDto } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: JwtPayload }): Promise<UserMeDto> {
    return this.usersService.me(req.user.sub);
  }
}
