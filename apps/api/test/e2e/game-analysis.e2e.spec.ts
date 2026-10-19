// @layer: integration
// @spec: 018-post-game-analysis
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

// ── helpers ───────────────────────────────────────────────────────────────────

const BASE_AUTH = "/api/v1/auth";

async function registerVerifyLogin(email: string, nickname: string): Promise<string> {
  await request(app.getHttpServer())
    .post(`${BASE_AUTH}/register`)
    .send({ email, nickname, password: "Test1234", confirmPassword: "Test1234", country: "US" })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${BASE_AUTH}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${BASE_AUTH}/login`)
    .send({ email, password: "Test1234", rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

async function seedGame(
  prisma: PrismaService,
  whiteUserId: string,
  blackUserId: string,
): Promise<string> {
  const game = await prisma.game.create({
    data: {
      mode: "Blitz",
      timeControlMs: 300_000,
      whiteUserId,
      blackUserId,
      result: "white_win",
      endReason: "checkmate",
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7",
      finalFen: "r1bqk2r/1bpp1ppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 2 6",
      whiteRatingBefore: 1500,
      whiteRatingAfter: 1516,
      blackRatingBefore: 1500,
      blackRatingAfter: 1484,
      startedAt: new Date("2026-10-18T10:00:00Z"),
      endedAt: new Date("2026-10-18T10:10:00Z"),
    },
  });
  return game.id;
}

const MOVE_BODY = (moveIndex: number) => ({
  playerColor: moveIndex % 2 === 0 ? "white" : "black",
  category: "Best",
  evaluationCp: 10 + moveIndex,
  mateIn: null,
  bestMoveUci: "e2e4",
  classifierVersion: 1,
  engineDepth: 18,
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("[@spec:018-post-game-analysis] game-analysis e2e", () => {
  it(
    "alice PUTs 5 move analyses + POSTs finalize, bob GETs → 5 moves ordered + completedAt set",
    async () => {
      const aliceToken = await registerVerifyLogin("alice.analysis@test.com", "alice_analysis");
      const bobToken = await registerVerifyLogin("bob.analysis@test.com", "bob_analysis");

      const prisma = app.get(PrismaService);
      const alice = await prisma.user.findFirst({ where: { nickname: "alice_analysis" } });
      const bob = await prisma.user.findFirst({ where: { nickname: "bob_analysis" } });
      expect(alice).not.toBeNull();
      expect(bob).not.toBeNull();

      const gameId = await seedGame(prisma, alice!.id, bob!.id);

      // alice writes 5 moves out of order to test ordering
      for (const idx of [4, 2, 0, 3, 1]) {
        await request(app.getHttpServer())
          .put(`/api/v1/games/${gameId}/analysis/moves/${idx}`)
          .set("Authorization", `Bearer ${aliceToken}`)
          .send(MOVE_BODY(idx))
          .expect(200)
          .expect({ ok: true });
      }

      // alice finalizes
      await request(app.getHttpServer())
        .post(`/api/v1/games/${gameId}/analysis/finalize`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ classifierVersion: 1, engineDepth: 18 })
        .expect(201)
        .expect({ ok: true });

      // bob reads — should see 5 moves ordered by moveIndex
      const res = await request(app.getHttpServer())
        .get(`/api/v1/games/${gameId}/analysis`)
        .set("Authorization", `Bearer ${bobToken}`)
        .expect(200);

      const body = res.body as {
        gameId: string;
        completedAt: string | null;
        moves: Array<{ moveIndex: number }>;
      };

      expect(body.gameId).toBe(gameId);
      expect(body.completedAt).not.toBeNull();
      expect(body.moves).toHaveLength(5);
      expect(body.moves.map((m) => m.moveIndex)).toEqual([0, 1, 2, 3, 4]);
    },
    30_000,
  );

  it(
    "charlie (non-participant) GETs alice+bob game analysis → 403",
    async () => {
      const aliceToken = await registerVerifyLogin("alice.analysis2@test.com", "alice_analysis2");
      await registerVerifyLogin("bob.analysis2@test.com", "bob_analysis2");
      const charlieToken = await registerVerifyLogin("charlie.analysis@test.com", "charlie_analysis");

      const prisma = app.get(PrismaService);
      const alice = await prisma.user.findFirst({ where: { nickname: "alice_analysis2" } });
      const bob = await prisma.user.findFirst({ where: { nickname: "bob_analysis2" } });
      expect(alice).not.toBeNull();
      expect(bob).not.toBeNull();

      const gameId = await seedGame(prisma, alice!.id, bob!.id);

      // alice creates analysis
      await request(app.getHttpServer())
        .put(`/api/v1/games/${gameId}/analysis/moves/0`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send(MOVE_BODY(0))
        .expect(200);

      // charlie tries to read → 403
      await request(app.getHttpServer())
        .get(`/api/v1/games/${gameId}/analysis`)
        .set("Authorization", `Bearer ${charlieToken}`)
        .expect(403);
    },
    30_000,
  );
});
