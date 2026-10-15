import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { updateMeSchema } from "@yanchess/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, type JwtPayload } from "../auth/guards/jwt-auth.guard";
import { UsersService, type UserMeDto, type UpdateMeDto } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: JwtPayload }): Promise<UserMeDto> {
    return this.usersService.me(req.user.sub);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(updateMeSchema))
  async updateMe(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: UpdateMeDto,
  ): Promise<UserMeDto> {
    return this.usersService.updateMe(req.user.sub, dto);
  }
}
