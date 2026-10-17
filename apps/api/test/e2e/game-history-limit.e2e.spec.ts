// @layer: integration
// @spec: 017-home-games-list
// @regression
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";
import { PrismaService } from "../../src/modules/prisma/prisma.service";

let app: INestApplication;

beforeAll(async () => {
  app = await bootTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetAll(app);
});

const AUTH_BASE = "/api/v1/auth";
const HISTORY_BASE = "/api/v1";

async function registerVerifyLogin(email: string, nickname: string): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH_BASE}/register`)
    .send({ email, nickname, password: "Test1234", confirmPassword: "Test1234", country: "US" })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${AUTH_BASE}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${AUTH_BASE}/login`)
    .send({ email, password: "Test1234", rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

describe("[@spec:017-home-games-list][@regression] GET /users/me/games?limit=10", () => {
  it(
    "returns 10 games when 15 are seeded, pageSize===10, ordered newest-first",
    async () => {
      const aliceToken = await registerVerifyLogin("alice.limit@limit.test", "alice_limit");
      const bobToken = await registerVerifyLogin("bob.limit@limit.test", "bob_limit");
      void bobToken;

      const prisma = app.get(PrismaService);
      const alice = await prisma.user.findFirst({ where: { nickname: "alice_limit" } });
      const bob = await prisma.user.findFirst({ where: { nickname: "bob_limit" } });

      const now = new Date();
      await prisma.game.createMany({
        data: Array.from({ length: 15 }, (_, i) => ({
          mode: "Blitz",
          timeControlMs: 180_000,
          whiteUserId: alice!.id,
          blackUserId: bob!.id,
          result: "white_win",
          endReason: "resignation",
          pgn: `[Event "?"]\n1. e4 *`,
          finalFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          whiteRatingBefore: 1500,
          whiteRatingAfter: 1516,
          blackRatingBefore: 1500,
          blackRatingAfter: 1484,
          startedAt: new Date(now.getTime() - (i + 1) * 60_000),
          endedAt: new Date(now.getTime() - i * 60_000),
        })),
      });

      const res = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?limit=10`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body.games).toHaveLength(10);
      expect(res.body.pagination.perPage).toBe(10);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.totalPages).toBe(1);

      // Verify newest-first ordering: startedAt[0] > startedAt[1]
      const dates = (res.body.games as Array<{ startedAt: string }>).map((g) => new Date(g.startedAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]!).toBeGreaterThan(dates[i]!);
      }
    },
    20_000,
  );
});
