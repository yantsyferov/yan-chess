import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { Mode } from "@yanchess/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";
import { GameService } from "../game/game.service";

const FALLBACK_RATING = 1500;
const ENTRY_TTL_SEC = 300;
const MODES: Mode[] = ["Bullet", "Blitz", "Rapid", "Classical"];
const RATED_FLAGS = [true, false] as const;

/** Atomic Lua: removes both players from the searching set, the sorted queue, and their entries.
 *  Returns the number of SREM + ZREM elements removed (max 4: 2 from SREM + 2 from ZREM).
 *  KEYS[1] = mm:users:searching
 *  KEYS[2] = mm:queue:{mode}:{rated|unrated}
 *  KEYS[3] = mm:entry:{userId}
 *  KEYS[4] = mm:entry:{opponentId}
 *  ARGV[1] = userId
 *  ARGV[2] = opponentId
 */
const PAIR_SCRIPT = `
local removed = 0
removed = removed + redis.call("SREM", KEYS[1], ARGV[1], ARGV[2])
removed = removed + redis.call("ZREM", KEYS[2], ARGV[1], ARGV[2])
redis.call("DEL", KEYS[3])
redis.call("DEL", KEYS[4])
return removed
`;

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeEmitter,
    private readonly gameService: GameService,
  ) {}

  async joinQueue(userId: string, nickname: string, mode: Mode, isRated = true): Promise<{ since: number }> {
    const ratingRow = await this.prisma.ratingByMode.findUnique({
      where: { userId_mode: { userId, mode } },
      select: { rating: true },
    });
    const rating = ratingRow?.rating ?? FALLBACK_RATING;

    const added = await this.redis.sadd("mm:users:searching", userId);
    if (added === 0) {
      // Already in a queue — return existing entry
      const entry = await this.redis.hgetall(`mm:entry:${userId}`);
      const since = entry["joinedAt"] !== undefined ? parseInt(entry["joinedAt"], 10) : Date.now();
      this.logger.debug(`User ${userId} already in queue since ${since}`);
      return { since };
    }

    const queueKey = isRated ? `mm:queue:${mode}:rated` : `mm:queue:${mode}:unrated`;
    const now = Date.now();
    await this.redis.raw.zadd(queueKey, rating, userId);
    await this.redis.hset(`mm:entry:${userId}`, {
      mode,
      rating,
      nickname,
      joinedAt: now,
      isRated: isRated ? "true" : "false",
    });
    await this.redis.expire(`mm:entry:${userId}`, ENTRY_TTL_SEC);

    this.logger.log(`User ${userId} joined queue mode=${mode} rated=${isRated} rating=${rating}`);
    return { since: now };
  }

  async leaveQueue(userId: string): Promise<void> {
    const entry = await this.redis.hgetall(`mm:entry:${userId}`);
    const mode = entry["mode"] as Mode | undefined;

    if (mode === undefined) {
      // Idempotent no-op
      return;
    }

    const isRated = entry["isRated"] !== "false";
    const queueKey = isRated ? `mm:queue:${mode}:rated` : `mm:queue:${mode}:unrated`;

    const multi = this.redis.raw.multi();
    multi.srem("mm:users:searching", userId);
    multi.zrem(queueKey, userId);
    multi.del(`mm:entry:${userId}`);
    await multi.exec();

    this.logger.log(`User ${userId} left queue mode=${mode} rated=${isRated}`);
  }

  async getQueueEntry(userId: string): Promise<{ mode: Mode; since: number } | null> {
    const entry = await this.redis.hgetall(`mm:entry:${userId}`);
    if (!entry["mode"] || !entry["joinedAt"]) {
      return null;
    }
    return {
      mode: entry["mode"] as Mode,
      since: parseInt(entry["joinedAt"], 10),
    };
  }

  @Interval(1000)
  async runPairingCycle(): Promise<void> {
    for (const mode of MODES) {
      for (const isRated of RATED_FLAGS) {
        try {
          await this.pairOneInMode(mode, isRated);
        } catch (err: unknown) {
          this.logger.error(`Pairing cycle error mode=${mode} rated=${isRated}: ${String(err)}`);
        }
      }
    }
  }

  private async pairOneInMode(mode: Mode, isRated: boolean): Promise<void> {
    const queueKey = isRated ? `mm:queue:${mode}:rated` : `mm:queue:${mode}:unrated`;
    // Returns [member, score, member, score, ...]
    const raw = await this.redis.raw.zrange(queueKey, 0, -1, "WITHSCORES");
    if (raw.length < 4) return; // Need at least 2 entries (4 elements)

    // Build a list of {userId, score (rating)} from alternating raw entries
    const candidates: Array<{ userId: string; score: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      candidates.push({ userId: raw[i] as string, score: parseFloat(raw[i + 1] as string) });
    }

    for (const candidate of candidates) {
      const { userId } = candidate;

      const entryHash = await this.redis.hgetall(`mm:entry:${userId}`);
      if (!entryHash["joinedAt"]) continue;

      const joinedAt = parseInt(entryHash["joinedAt"], 10);
      const rating = parseFloat(entryHash["rating"] ?? String(candidate.score));
      const waitSec = (Date.now() - joinedAt) / 1000;
      const exponent = Math.floor(waitSec / 10);
      const delta = 100 * Math.pow(2, exponent);
      const safeDelta = Math.min(delta, Number.MAX_SAFE_INTEGER);

      const minScore = rating - safeDelta;
      const maxScore = rating + safeDelta;

      const eligibleRaw = await this.redis.raw.zrangebyscore(
        queueKey,
        minScore,
        maxScore,
      );

      const eligible = eligibleRaw.filter((id) => id !== userId);
      if (eligible.length === 0) continue;

      // Pick nearest-rating opponent
      let opponentId = eligible[0] as string;
      let minDiff = Infinity;
      for (const id of eligible) {
        const oppEntry = await this.redis.hgetall(`mm:entry:${id}`);
        const oppRating = oppEntry["rating"] !== undefined
          ? parseFloat(oppEntry["rating"])
          : (candidates.find((c) => c.userId === id)?.score ?? rating);
        const diff = Math.abs(oppRating - rating);
        if (diff < minDiff) {
          minDiff = diff;
          opponentId = id;
        }
      }

      // Atomic removal via Lua
      const removed = await this.redis.raw.eval(
        PAIR_SCRIPT,
        4,
        "mm:users:searching",
        queueKey,
        `mm:entry:${userId}`,
        `mm:entry:${opponentId}`,
        userId,
        opponentId,
      ) as number;

      // Expect 4: 2 from SREM + 2 from ZREM. If less, someone else already paired one of them.
      if (removed < 4) {
        this.logger.debug(`Race condition pairing ${userId} vs ${opponentId}, removed=${removed}`);
        continue;
      }

      // Assign colours
      const [whiteId, blackId] =
        Math.random() < 0.5 ? [userId, opponentId] : [opponentId, userId];

      // Create game record
      const game = await this.gameService.createGame(whiteId, blackId, mode, isRated);
      const { gameId, timeControlMs, fen, sideToMove, serverNow } = game;
      const whiteClockMs = timeControlMs;
      const blackClockMs = timeControlMs;

      // Join both players' sockets to the game room
      await this.realtime.toRoom("play", `user:${whiteId}`).socketsJoin(`game:${gameId}`);
      await this.realtime.toRoom("play", `user:${blackId}`).socketsJoin(`game:${gameId}`);

      // Emit game.start to each player
      this.realtime.toUser(whiteId, "play").emit("game.start", {
        gameId,
        color: "white",
        opponent: { nickname: game.black.nickname, rating: game.black.rating },
        mode,
        timeControlMs,
        fen,
        clocks: { whiteMs: whiteClockMs, blackMs: blackClockMs },
        sideToMove,
        serverNow,
      });

      this.realtime.toUser(blackId, "play").emit("game.start", {
        gameId,
        color: "black",
        opponent: { nickname: game.white.nickname, rating: game.white.rating },
        mode,
        timeControlMs,
        fen,
        clocks: { whiteMs: whiteClockMs, blackMs: blackClockMs },
        sideToMove,
        serverNow,
      });

      this.logger.log(
        `Paired ${whiteId}(white) vs ${blackId}(black) mode=${mode} gameId=${gameId}`,
      );

      // One pair per mode per cycle
      break;
    }
  }
}
