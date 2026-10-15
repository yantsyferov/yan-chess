import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import Redis, { ChainableCommander } from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  async onModuleInit(): Promise<void> {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    await this.client.connect();
    this.logger.log(`Redis connected: ${url}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (ttlSec !== undefined) await this.client.set(key, value, "EX", ttlSec);
    else await this.client.set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async hset(key: string, data: Record<string, string | number>): Promise<void> {
    await this.client.hset(key, data);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async expire(key: string, ttlSec: number): Promise<number> {
    return this.client.expire(key, ttlSec);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  pipeline(): ChainableCommander {
    return this.client.pipeline();
  }

  /** Escape hatch for one-off operations not covered above. Prefer adding a typed method. */
  get raw(): Redis {
    return this.client;
  }
}
