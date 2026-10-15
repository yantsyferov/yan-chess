import { Injectable } from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitter } from "./realtime-emitter";

export interface FriendPresencePayload {
  userId: string;
  online: boolean;
}

@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  async getSocketCount(userId: string): Promise<number> {
    return this.realtime.socketCount(userId);
  }

  async broadcastPresence(userId: string, online: boolean): Promise<void> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    });

    const payload: FriendPresencePayload = { userId, online };
    for (const f of friendships) {
      const friendId = f.userAId === userId ? f.userBId : f.userAId;
      this.realtime.toUser(friendId, "friends").emit("friend.presence", payload);
    }
  }
}
