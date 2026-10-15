import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSec: number;
}

@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: RedisService) {}

  async check(key: string, windowSec: number, limit: number): Promise<RateLimitCheckResult> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      // First increment in this window — set TTL.
      await this.redis.expire(key, windowSec);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(key);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  }
}
