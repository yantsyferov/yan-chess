import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import type {
  FriendAcceptedPayload,
  FriendDeclinedPayload,
  FriendListResponse,
  FriendRequestedPayload,
  FriendRequestsResponse,
  FriendSearchResponse,
  FriendUnfriendedPayload,
} from "@yanchess/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";
import { PresenceService } from "../realtime/presence.service";

const FALLBACK_BLITZ_RATING = 1500;

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitter,
    private readonly presenceService: PresenceService,
  ) {}

  canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async listFriends(myUserId: string): Promise<FriendListResponse> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ userAId: myUserId }, { userBId: myUserId }],
      },
      include: {
        userA: {
          select: {
            id: true,
            nickname: true,
            ratings: { where: { mode: "Blitz" }, select: { rating: true } },
          },
        },
        userB: {
          select: {
            id: true,
            nickname: true,
            ratings: { where: { mode: "Blitz" }, select: { rating: true } },
          },
        },
      },
    });

    const friendsBase = friendships.map((f) => {
      const friend = f.userAId === myUserId ? f.userB : f.userA;
      const blitzRating = friend.ratings[0]?.rating ?? FALLBACK_BLITZ_RATING;
      const friendedAt = f.respondedAt?.toISOString() ?? f.createdAt.toISOString();
      return {
        userId: friend.id,
        nickname: friend.nickname,
        blitzRating,
        friendedAt,
      };
    });

    const onlineFlags = await Promise.all(
      friendsBase.map((f) => this.presenceService.getSocketCount(f.userId).then((c) => c > 0)),
    );

    const friends = friendsBase.map((f, i) => ({ ...f, online: onlineFlags[i] ?? false }));

    return { friends };
  }

  async listRequests(myUserId: string): Promise<FriendRequestsResponse> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.pending,
        initiatedBy: { not: myUserId },
        OR: [{ userAId: myUserId }, { userBId: myUserId }],
      },
      include: {
        userA: { select: { id: true, nickname: true } },
        userB: { select: { id: true, nickname: true } },
      },
    });

    const requests = friendships.map((f) => {
      const requester = f.initiatedBy === f.userAId ? f.userA : f.userB;
      return {
        friendshipId: f.id,
        requesterUserId: requester.id,
        requesterNickname: requester.nickname,
        createdAt: f.createdAt.toISOString(),
      };
    });

    return { requests };
  }

  async search(myUserId: string, q: string): Promise<FriendSearchResponse> {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      return { results: [] };
    }

    // Fetch users matching the query (excluding self), cap at 20
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: myUserId },
        nicknameNormalized: { contains: trimmed.toLowerCase(), mode: "insensitive" },
      },
      take: 20,
      select: {
        id: true,
        nickname: true,
        ratings: { where: { mode: "Blitz" }, select: { rating: true } },
      },
    });

    if (users.length === 0) {
      return { results: [] };
    }

    const userIds = users.map((u) => u.id);

    // Batch fetch all friendships involving me and any of the result users
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: myUserId, userBId: { in: userIds } },
          { userBId: myUserId, userAId: { in: userIds } },
        ],
      },
    });

    // Build a map: otherId → friendship row
    const friendshipMap = new Map<string, (typeof friendships)[number]>();
    for (const f of friendships) {
      const otherId = f.userAId === myUserId ? f.userBId : f.userAId;
      friendshipMap.set(otherId, f);
    }

    const results = users.map((u) => {
      const f = friendshipMap.get(u.id);
      const blitzRating = u.ratings[0]?.rating ?? FALLBACK_BLITZ_RATING;

      if (!f) {
        return { userId: u.id, nickname: u.nickname, blitzRating, relationship: "none" as const, friendshipId: null };
      }

      if (f.status === FriendshipStatus.accepted) {
        return { userId: u.id, nickname: u.nickname, blitzRating, relationship: "friend" as const, friendshipId: null };
      }

      // pending
      if (f.initiatedBy === myUserId) {
        return { userId: u.id, nickname: u.nickname, blitzRating, relationship: "pending_outbound" as const, friendshipId: null };
      }

      // pending inbound
      return { userId: u.id, nickname: u.nickname, blitzRating, relationship: "pending_inbound" as const, friendshipId: f.id };
    });

    return { results };
  }

  async sendRequest(myUserId: string, targetUserId: string): Promise<{ status: "pending" | "accepted"; friendshipId: string }> {
    if (targetUserId === myUserId) {
      throw new BadRequestException("cannot friend yourself");
    }

    const [userAId, userBId] = this.canonicalPair(myUserId, targetUserId);

    const existing = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: {
        userA: { select: { id: true, nickname: true } },
        userB: { select: { id: true, nickname: true } },
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.accepted) {
        throw new ConflictException({ code: "already_friends" });
      }

      if (existing.status === FriendshipStatus.pending && existing.initiatedBy === myUserId) {
        throw new ConflictException({ code: "already_pending" });
      }

      // pending from the other side — auto-accept
      const updated = await this.prisma.friendship.update({
        where: { id: existing.id },
        data: { status: FriendshipStatus.accepted, respondedAt: new Date() },
      });

      // Emit friend.accepted to BOTH sides — each gets the OTHER user's info
      const myUser = existing.userAId === myUserId ? existing.userA : existing.userB;
      const targetUser = existing.userAId === myUserId ? existing.userB : existing.userA;

      const toTarget: FriendAcceptedPayload = {
        friendshipId: updated.id,
        friendUserId: myUserId,
        friendNickname: myUser.nickname,
      };
      const toMe: FriendAcceptedPayload = {
        friendshipId: updated.id,
        friendUserId: targetUserId,
        friendNickname: targetUser.nickname,
      };
      this.realtime.toUser(targetUserId, "friends").emit("friend.accepted", toTarget);
      this.realtime.toUser(myUserId, "friends").emit("friend.accepted", toMe);

      return { status: "accepted", friendshipId: updated.id };
    }

    // Fetch requester's nickname for the emitted payload
    const myUser = await this.prisma.user.findUnique({
      where: { id: myUserId },
      select: { nickname: true },
    });

    const created = await this.prisma.friendship.create({
      data: { userAId, userBId, status: FriendshipStatus.pending, initiatedBy: myUserId },
    });

    // Emit friend.requested to the recipient
    const requestedPayload: FriendRequestedPayload = {
      friendshipId: created.id,
      requesterUserId: myUserId,
      requesterNickname: myUser?.nickname ?? myUserId,
    };
    this.realtime.toUser(targetUserId, "friends").emit("friend.requested", requestedPayload);

    return { status: "pending", friendshipId: created.id };
  }

  async acceptRequest(myUserId: string, friendshipId: string): Promise<{ ok: true }> {
    const f = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: {
        userA: { select: { id: true, nickname: true } },
        userB: { select: { id: true, nickname: true } },
      },
    });

    if (!f) throw new NotFoundException({ code: "not_found" });

    if (f.status !== FriendshipStatus.pending) {
      throw new ConflictException({ code: "not_pending" });
    }

    if (f.userAId !== myUserId && f.userBId !== myUserId) {
      throw new ForbiddenException();
    }

    if (f.initiatedBy === myUserId) {
      throw new ForbiddenException({ code: "cannot_accept_own_request" });
    }

    await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.accepted, respondedAt: new Date() },
    });

    // Emit friend.accepted to BOTH sides — each gets the OTHER user's info
    const myUser = f.userAId === myUserId ? f.userA : f.userB;
    const initiatorId = f.initiatedBy;
    const initiatorUser = f.userAId === initiatorId ? f.userA : f.userB;

    const toInitiator: FriendAcceptedPayload = {
      friendshipId,
      friendUserId: myUserId,
      friendNickname: myUser.nickname,
    };
    const toMe: FriendAcceptedPayload = {
      friendshipId,
      friendUserId: initiatorId,
      friendNickname: initiatorUser.nickname,
    };
    this.realtime.toUser(initiatorId, "friends").emit("friend.accepted", toInitiator);
    this.realtime.toUser(myUserId, "friends").emit("friend.accepted", toMe);

    return { ok: true };
  }

  async unfriend(myUserId: string, otherUserId: string): Promise<{ ok: true }> {
    if (otherUserId === myUserId) {
      throw new BadRequestException("cannot unfriend yourself");
    }

    const [userAId, userBId] = this.canonicalPair(myUserId, otherUserId);

    const f = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    if (!f || f.status !== FriendshipStatus.accepted) {
      throw new NotFoundException({ code: "not_found" });
    }

    await this.prisma.friendship.delete({ where: { id: f.id } });

    const toMe: FriendUnfriendedPayload = { friendUserId: otherUserId };
    const toOther: FriendUnfriendedPayload = { friendUserId: myUserId };
    this.realtime.toUser(myUserId, "friends").emit("friend.unfriended", toMe);
    this.realtime.toUser(otherUserId, "friends").emit("friend.unfriended", toOther);

    return { ok: true };
  }

  async declineRequest(myUserId: string, friendshipId: string): Promise<{ ok: true }> {
    const f = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });

    if (!f) throw new NotFoundException({ code: "not_found" });

    if (f.status !== FriendshipStatus.pending) {
      throw new ConflictException({ code: "not_pending" });
    }

    if (f.userAId !== myUserId && f.userBId !== myUserId) {
      throw new ForbiddenException();
    }

    if (f.initiatedBy === myUserId) {
      throw new ForbiddenException({ code: "cannot_decline_own_request" });
    }

    const initiatorId = f.initiatedBy;

    await this.prisma.friendship.delete({ where: { id: friendshipId } });

    // Emit friend.declined to the initiator only
    const declinedPayload: FriendDeclinedPayload = { friendshipId };
    this.realtime.toUser(initiatorId, "friends").emit("friend.declined", declinedPayload);

    return { ok: true };
  }
}
