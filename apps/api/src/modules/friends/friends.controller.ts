import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  FriendListResponse,
  FriendRequestsResponse,
  FriendSearchResponse,
} from "@yanchess/shared";
import { JwtAuthGuard, type JwtPayload } from "../auth/guards/jwt-auth.guard";
import { FriendsService } from "./friends.service";

@Controller("friends")
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async listFriends(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<FriendListResponse> {
    return this.friendsService.listFriends(req.user.sub);
  }

  @Get("requests")
  async listRequests(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<FriendRequestsResponse> {
    return this.friendsService.listRequests(req.user.sub);
  }

  @Get("search")
  async search(
    @Req() req: Request & { user: JwtPayload },
    @Query("q") q: string,
  ): Promise<FriendSearchResponse> {
    return this.friendsService.search(req.user.sub, q ?? "");
  }

  @Post("requests")
  async sendRequest(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: { userId: string },
  ): Promise<{ status: "pending" | "accepted"; friendshipId: string }> {
    return this.friendsService.sendRequest(req.user.sub, body.userId);
  }

  @Post("requests/:friendshipId/accept")
  async acceptRequest(
    @Req() req: Request & { user: JwtPayload },
    @Param("friendshipId") friendshipId: string,
  ): Promise<{ ok: true }> {
    return this.friendsService.acceptRequest(req.user.sub, friendshipId);
  }

  @Delete(":userId")
  async unfriend(
    @Req() req: Request & { user: JwtPayload },
    @Param("userId") userId: string,
  ): Promise<{ ok: true }> {
    return this.friendsService.unfriend(req.user.sub, userId);
  }

  @Post("requests/:friendshipId/decline")
  async declineRequest(
    @Req() req: Request & { user: JwtPayload },
    @Param("friendshipId") friendshipId: string,
  ): Promise<{ ok: true }> {
    return this.friendsService.declineRequest(req.user.sub, friendshipId);
  }
}
