// @layer: integration
// @spec: 001-registration-and-login
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/modules/prisma/prisma.service";
import { RedisService } from "../../src/modules/redis/redis.service";
import { readdirSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const OUTBOX = join(process.cwd(), "dev-outbox");

export async function bootTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // bodyParser is enabled by default in NestJS platform-express; passing explicit option ensures it
  const app = moduleRef.createNestApplication({ bodyParser: true });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  await app.init();
  return app;
}

export async function resetAll(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe('TRUNCATE "users" CASCADE');
  const redis = app.get(RedisService);
  const keys = await redis.raw.keys("session:*");
  const skeys = await redis.raw.keys("user:sessions:*");
  const rlkeys = await redis.raw.keys("rl:*");
  const mmkeys = await redis.raw.keys("mm:*");
  const gamekeys = await redis.raw.keys("game:*");
  const ugkeys = await redis.raw.keys("user:activeGame:*");
  const rematchkeys = await redis.raw.keys("rematch:*");
  const all = [...keys, ...skeys, ...rlkeys, ...mmkeys, ...gamekeys, ...ugkeys, ...rematchkeys];
  if (all.length > 0) await redis.del(...all);
  clearOutbox();
}

export function clearOutbox(): void {
  try { rmSync(OUTBOX, { recursive: true, force: true }); } catch { /* ignore */ }
  mkdirSync(OUTBOX, { recursive: true });
}

export function latestToken(): string {
  const files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error("No outbox files found");
  const latest = files[files.length - 1];
  const data = JSON.parse(readFileSync(join(OUTBOX, latest), "utf8")) as { token?: string };
  if (!data.token) throw new Error(`No token field in outbox file ${latest}`);
  return data.token;
}

export function latestTokenFor(email: string): string {
  const files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  // search from newest to oldest for the email
  for (let i = files.length - 1; i >= 0; i--) {
    const data = JSON.parse(readFileSync(join(OUTBOX, files[i]!), "utf8")) as { to?: string; token?: string };
    if (data.to === email && data.token) return data.token;
  }
  throw new Error(`No outbox file for ${email}`);
}
