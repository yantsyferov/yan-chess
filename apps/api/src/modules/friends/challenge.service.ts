import { Injectable, Logger } from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  ChallengeColor,
  ChallengeSendPayload,
} from "@yanchess/shared";
import type { Mode } from "@yanchess/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { FriendsService } from "./friends.service";
import { PresenceService } from "../realtime/presence.service";
import { GameService, type CreatedGame } from "../game/game.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";

export interface ChallengeRecord {
  challengerId: string;
  targetId: string;
  mode: Mode;
  color: ChallengeColor;
  createdAt: number;
  timeoutAt: number;
}

export type ChallengeSendResult =
  | { ok: true; challengeId?: string; timeoutAt?: number }
  | { ok: false; code: string };

export type ChallengeRespondResult =
  | { ok: true }
  | { ok: false; code: string };

export type ChallengeCancelResult =
  | { ok: true }
  | { ok: false; code: string };

const CHALLENGE_TTL_SEC = 65;

@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly friendsService: FriendsService,
    private readonly presenceService: PresenceService,
    private readonly gameService: GameService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  async sendChallenge(
    myUserId: string,
    myNickname: string,
    body: ChallengeSendPayload,
  ): Promise<ChallengeSendResult> {
    const { targetUserId, mode, color } = body;

    // 1. Reject self
    if (targetUserId === myUserId) {
      return { ok: false, code: "cannot_challenge_self" };
    }

    // 2. Check target is a friend
    const [userAId, userBId] = this.friendsService.canonicalPair(myUserId, targetUserId);
    const friendship = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (!friendship || friendship.status !== FriendshipStatus.accepted) {
      return { ok: false, code: "not_friends" };
    }

    // 3. Check target is online
    const targetSocketCount = await this.presenceService.getSocketCount(targetUserId);
    if (targetSocketCount === 0) {
      return { ok: false, code: "target_offline" };
    }

    // 4. Check challenger is not in a game
    const myActiveGame = await this.redis.get(`user:activeGame:${myUserId}`);
    if (myActiveGame !== null) {
      return { ok: false, code: "challenger_in_game" };
    }

    // 5. Check target is not in a game
    const targetActiveGame = await this.redis.get(`user:activeGame:${targetUserId}`);
    if (targetActiveGame !== null) {
      return { ok: false, code: "target_in_game" };
    }

    // 6. Mutual-race check
    const targetOutboundChallengeId = await this.redis.get(`user:activeChallenge:${targetUserId}`);
    if (targetOutboundChallengeId !== null) {
      const targetChallenge = await this.redis.hgetall(`challenge:${targetOutboundChallengeId}`);
      if (targetChallenge && targetChallenge["challengerId"] === targetUserId && targetChallenge["targetId"] === myUserId) {
        // Mutual race — auto-accept the target's existing challenge
        const resolveResult = await this.resolveAccept(targetOutboundChallengeId);
        if (!resolveResult.ok) {
          return resolveResult;
        }
        return { ok: true };
      }
    }

    // 7. Replace outbound challenge if one exists
    const myCurrentChallengeId = await this.redis.get(`user:activeChallenge:${myUserId}`);
    if (myCurrentChallengeId !== null) {
      const oldChallenge = await this.redis.hgetall(`challenge:${myCurrentChallengeId}`);
      if (oldChallenge && oldChallenge["targetId"]) {
        const oldTargetId = oldChallenge["targetId"];
        await this.redis.del(`challenge:${myCurrentChallengeId}`);
        await this.redis.srem("challenge:active", myCurrentChallengeId);
        this.realtime.toUser(oldTargetId, "friends").emit("challenge.cancelled", { challengeId: myCurrentChallengeId });
      }
    }

    // 8. Create challenge
    const challengeId = randomUUID();
    const createdAt = Date.now();
    const timeoutAt = createdAt + 60_000;

    await this.redis.hset(`challenge:${challengeId}`, {
      challengerId: myUserId,
      targetId: targetUserId,
      mode,
      color,
      createdAt,
      timeoutAt,
    });
    await this.redis.expire(`challenge:${challengeId}`, CHALLENGE_TTL_SEC);
    await this.redis.set(`user:activeChallenge:${myUserId}`, challengeId, CHALLENGE_TTL_SEC);
    await this.redis.sadd("challenge:active", challengeId);

    // 9. Emit to target
    this.realtime.toUser(targetUserId, "friends").emit("challenge.received", {
      challengeId,
      challengerUserId: myUserId,
      challengerNickname: myNickname,
      mode,
      color,
      timeoutAt,
    });

    this.logger.log(`Challenge sent challengeId=${challengeId} from=${myUserId} to=${targetUserId} mode=${mode}`);

    return { ok: true, challengeId, timeoutAt };
  }

  async getActiveChallengeId(userId: string): Promise<string | null> {
    return this.redis.get(`user:activeChallenge:${userId}`);
  }

  async getChallengeRecord(challengeId: string): Promise<ChallengeRecord | null> {
    const data = await this.redis.hgetall(`challenge:${challengeId}`);
    if (!data || !data["challengerId"]) return null;
    return {
      challengerId: data["challengerId"],
      targetId: data["targetId"],
      mode: data["mode"] as Mode,
      color: data["color"] as ChallengeColor,
      createdAt: Number(data["createdAt"]),
      timeoutAt: Number(data["timeoutAt"]),
    };
  }

  async resolveAccept(challengeId: string): Promise<{ ok: true } | { ok: false; code: string }> {
    const data = await this.redis.hgetall(`challenge:${challengeId}`);
    if (!data || !data["challengerId"]) {
      return { ok: false, code: "not_found" };
    }

    const challengerId = data["challengerId"];
    const targetId = data["targetId"];
    const mode = data["mode"] as Mode;
    const color = data["color"] as ChallengeColor;

    // Roll color if random
    let whiteId: string;
    let blackId: string;
    if (color === "random") {
      if (Math.random() < 0.5) {
        whiteId = challengerId;
        blackId = targetId;
      } else {
        whiteId = targetId;
        blackId = challengerId;
      }
    } else if (color === "white") {
      // challenger wants white
      whiteId = challengerId;
      blackId = targetId;
    } else {
      // challenger wants black
      whiteId = targetId;
      blackId = challengerId;
    }

    const createdGame: CreatedGame = await this.gameService.createGame(whiteId, blackId, mode);
    const { gameId, timeControlMs, fen, sideToMove, serverNow } = createdGame;

    // Join both players to game room on /play namespace
    await this.realtime.toRoom("play", `user:${whiteId}`).socketsJoin(`game:${gameId}`);
    await this.realtime.toRoom("play", `user:${blackId}`).socketsJoin(`game:${gameId}`);

    // Emit game.start to each player on /play
    this.realtime.toUser(whiteId, "play").emit("game.start", {
      gameId,
      color: "white",
      opponent: { nickname: createdGame.black.nickname, rating: createdGame.black.rating },
      mode,
      timeControlMs,
      fen,
      clocks: { whiteMs: timeControlMs, blackMs: timeControlMs },
      sideToMove,
      serverNow,
    });

    this.realtime.toUser(blackId, "play").emit("game.start", {
      gameId,
      color: "black",
      opponent: { nickname: createdGame.white.nickname, rating: createdGame.white.rating },
      mode,
      timeControlMs,
      fen,
      clocks: { whiteMs: timeControlMs, blackMs: timeControlMs },
      sideToMove,
      serverNow,
    });

    // Clean up Redis challenge state
    await this.redis.del(`challenge:${challengeId}`);
    await this.redis.del(`user:activeChallenge:${challengerId}`);
    await this.redis.srem("challenge:active", challengeId);

    // Emit challenge.cancelled to both as cleanup
    this.realtime.toUser(challengerId, "friends").emit("challenge.cancelled", { challengeId });
    this.realtime.toUser(targetId, "friends").emit("challenge.cancelled", { challengeId });

    this.logger.log(`Challenge accepted challengeId=${challengeId} gameId=${gameId}`);

    return { ok: true };
  }

  async respondChallenge(
    myUserId: string,
    challengeId: string,
    accept: boolean,
  ): Promise<ChallengeRespondResult> {
    const data = await this.redis.hgetall(`challenge:${challengeId}`);
    if (!data || !data["challengerId"]) {
      return { ok: false, code: "not_found" };
    }

    if (data["targetId"] !== myUserId) {
      return { ok: false, code: "not_recipient" };
    }

    if (accept) {
      return this.resolveAccept(challengeId);
    } else {
      // Decline
      const challengerId = data["challengerId"];
      await this.redis.del(`challenge:${challengeId}`);
      await this.redis.del(`user:activeChallenge:${challengerId}`);
      await this.redis.srem("challenge:active", challengeId);

      this.realtime.toUser(challengerId, "friends").emit("challenge.declined", { challengeId });

      this.logger.log(`Challenge declined challengeId=${challengeId} by=${myUserId}`);
      return { ok: true };
    }
  }

  async cancelChallenge(
    myUserId: string,
    challengeId: string,
  ): Promise<ChallengeCancelResult> {
    const data = await this.redis.hgetall(`challenge:${challengeId}`);
    if (!data || !data["challengerId"]) {
      return { ok: false, code: "not_found" };
    }

    if (data["challengerId"] !== myUserId) {
      return { ok: false, code: "not_challenger" };
    }

    const targetId = data["targetId"];
    await this.redis.del(`challenge:${challengeId}`);
    await this.redis.del(`user:activeChallenge:${myUserId}`);
    await this.redis.srem("challenge:active", challengeId);

    this.realtime.toUser(targetId, "friends").emit("challenge.cancelled", { challengeId });

    this.logger.log(`Challenge cancelled challengeId=${challengeId} by=${myUserId}`);
    return { ok: true };
  }
}
