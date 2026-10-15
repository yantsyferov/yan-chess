import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { RedisService } from "../redis/redis.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";

@Injectable()
export class ChallengeExpirySweeper {
  private readonly logger = new Logger(ChallengeExpirySweeper.name);

  constructor(
    private readonly redis: RedisService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  @Interval(1000)
  async sweep(): Promise<void> {
    const active = await this.redis.smembers("challenge:active");
    const now = Date.now();

    for (const challengeId of active) {
      const data = await this.redis.hgetall(`challenge:${challengeId}`);
      if (!data || !data["timeoutAt"]) {
        // Stale — remove from set
        await this.redis.srem("challenge:active", challengeId);
        continue;
      }

      if (Number(data["timeoutAt"]) < now) {
        try {
          this.realtime.toUser(data["challengerId"]!, "friends").emit("challenge.expired", { challengeId });
          this.realtime.toUser(data["targetId"]!, "friends").emit("challenge.expired", { challengeId });
        } catch {
          // Namespace not yet registered (e.g. during startup) — skip emit
        }

        await this.redis.del(`challenge:${challengeId}`);
        if (data["challengerId"]) {
          await this.redis.del(`user:activeChallenge:${data["challengerId"]}`);
        }
        await this.redis.srem("challenge:active", challengeId);

        this.logger.log(`Challenge expired challengeId=${challengeId}`);
      }
    }
  }
}
