// @layer: integration
// @spec: 006-game-history
// @regression
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";
import { PrismaService } from "../../src/modules/prisma/prisma.service";

let app: INestApplication;
let serverPort: number | null = null;

beforeAll(async () => {
  app = await bootTestApp();
});
afterAll(async () => {
  serverPort = null;
  await app.close();
});
beforeEach(async () => {
  await resetAll(app);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const AUTH_BASE = "/api/v1/auth";
const HISTORY_BASE = "/api/v1";

async function registerVerifyLogin(
  email: string,
  nickname: string,
  password = "Test1234",
): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH_BASE}/register`)
    .send({ email, nickname, password, confirmPassword: password, country: "US" })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${AUTH_BASE}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${AUTH_BASE}/login`)
    .send({ email, password, rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

async function ensureListening(): Promise<number> {
  if (serverPort !== null) return serverPort;
  await app.listen(0);
  const addr = (app.getHttpServer() as import("http").Server).address() as { port: number };
  serverPort = addr.port;
  return serverPort;
}

function connectSocket(accessToken: string, port: number): Socket {
  return ioClient(`http://localhost:${port}/play`, {
    auth: { token: `Bearer ${accessToken}` },
    transports: ["websocket"],
    autoConnect: true,
  });
}

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${event}"`));
    }, timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Registers alice + bob, plays one Blitz game, black resigns (white wins).
 *  Returns { tokenAlice, tokenBob, prismaGameId, aliceColor, bobColor }. */
async function playOneGame(): Promise<{
  tokenAlice: string;
  tokenBob: string;
  prismaGameId: string;
  aliceColor: "white" | "black";
  bobColor: "white" | "black";
}> {
  const tokenAlice = await registerVerifyLogin("alice@hist.test", "alice_hist");
  const tokenBob = await registerVerifyLogin("bob@hist.test", "bob_hist");

  const port = await ensureListening();
  const sockAlice = connectSocket(tokenAlice, port);
  const sockBob = connectSocket(tokenBob, port);

  await Promise.all([
    new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("alice connect timeout")), 5000);
      sockAlice.on("connect", () => { clearTimeout(t); res(); });
      sockAlice.on("connect_error", (e) => { clearTimeout(t); rej(e); });
    }),
    new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("bob connect timeout")), 5000);
      sockBob.on("connect", () => { clearTimeout(t); res(); });
      sockBob.on("connect_error", (e) => { clearTimeout(t); rej(e); });
    }),
  ]);

  const aliceStart = waitForEvent<{ gameId: string; color: string }>(sockAlice, "game.start");
  const bobStart = waitForEvent<{ gameId: string; color: string }>(sockBob, "game.start");

  sockAlice.emit("queue.join", { mode: "Blitz" });
  await pause(100);
  sockBob.emit("queue.join", { mode: "Blitz" });

  const [alicePayload, bobPayload] = await Promise.all([aliceStart, bobStart]);
  const redisGameId = alicePayload.gameId;

  const aliceColor = alicePayload.color as "white" | "black";
  const bobColor = bobPayload.color as "white" | "black";

  // The white socket makes one move, then black resigns
  const whiteSocket = aliceColor === "white" ? sockAlice : sockBob;
  const blackSocket = aliceColor === "black" ? sockAlice : sockBob;

  // Wait for game.state after move
  const aliceState = waitForEvent(sockAlice, "game.state");
  const bobState = waitForEvent(sockBob, "game.state");
  whiteSocket.emit("game.move", { gameId: redisGameId, from: "e2", to: "e4" });
  await Promise.all([aliceState, bobState]);

  // Black resigns
  const aliceEnd = waitForEvent(sockAlice, "game.end");
  const bobEnd = waitForEvent(sockBob, "game.end");
  blackSocket.emit("game.resign", { gameId: redisGameId });
  await Promise.all([aliceEnd, bobEnd]);

  sockAlice.disconnect();
  sockBob.disconnect();

  // Look up the Prisma game id by participants
  const prisma = app.get(PrismaService);
  const aliceUser = await prisma.user.findFirst({ where: { nickname: "alice_hist" } });
  const bobUser = await prisma.user.findFirst({ where: { nickname: "bob_hist" } });
  const gameRow = await prisma.game.findFirst({
    where: {
      OR: [
        { whiteUserId: aliceUser!.id, blackUserId: bobUser!.id },
        { whiteUserId: bobUser!.id, blackUserId: aliceUser!.id },
      ],
    },
  });
  if (!gameRow) throw new Error("Game not found in Postgres after playOneGame");

  return { tokenAlice, tokenBob, prismaGameId: gameRow.id, aliceColor, bobColor };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("[@spec:006-game-history][@regression] GET /users/me/games — list endpoint", () => {
  it(
    "@regression alice sees 1 game with correct perspective after black resigns",
    async () => {
      const { tokenAlice, tokenBob, aliceColor, bobColor } = await playOneGame();

      // alice: the loser if she was black, winner if white
      const aliceRes = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      expect(aliceRes.body.games).toHaveLength(1);
      const aliceGame = aliceRes.body.games[0];
      expect(aliceGame.playerColor).toBe(aliceColor);
      // black resigned → white wins
      expect(aliceGame.result).toBe(aliceColor === "white" ? "win" : "loss");
      expect(aliceGame.endReason).toBe("resignation");
      expect(aliceGame.opponent.nickname).toBe("bob_hist");
      expect(aliceGame.ratingDelta).toBe(aliceColor === "white" ? 16 : -16);

      // bob: opposite perspective
      const bobRes = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games`)
        .set("Authorization", `Bearer ${tokenBob}`)
        .expect(200);

      expect(bobRes.body.games).toHaveLength(1);
      const bobGame = bobRes.body.games[0];
      expect(bobGame.playerColor).toBe(bobColor);
      expect(bobGame.result).toBe(bobColor === "white" ? "win" : "loss");
      expect(bobGame.ratingDelta).toBe(bobColor === "white" ? 16 : -16);
      expect(bobGame.opponent.nickname).toBe("alice_hist");
    },
    35_000,
  );

  it(
    "@regression charlie (no games) sees empty list",
    async () => {
      await registerVerifyLogin("charlie@hist.test", "charlie_hist");
      const tokenCharlie = (
        await request(app.getHttpServer())
          .post(`${AUTH_BASE}/login`)
          .send({ email: "charlie@hist.test", password: "Test1234", rememberMe: false })
          .expect(200)
      ).body.accessToken as string;

      const res = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games`)
        .set("Authorization", `Bearer ${tokenCharlie}`)
        .expect(200);

      expect(res.body.games).toHaveLength(0);
      expect(res.body.pagination.totalGames).toBe(0);
    },
    20_000,
  );

  it(
    "@regression filter ?result=wins shows 1 for winner, 0 for loser",
    async () => {
      const { tokenAlice, tokenBob, aliceColor } = await playOneGame();

      const winner = aliceColor === "white" ? tokenAlice : tokenBob;
      const loser = aliceColor === "white" ? tokenBob : tokenAlice;

      const winRes = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?result=wins`)
        .set("Authorization", `Bearer ${winner}`)
        .expect(200);
      expect(winRes.body.games).toHaveLength(1);

      const loseRes = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?result=wins`)
        .set("Authorization", `Bearer ${loser}`)
        .expect(200);
      expect(loseRes.body.games).toHaveLength(0);
    },
    35_000,
  );

  it(
    "@regression filter ?mode=Rapid on Blitz game → 0 rows",
    async () => {
      const { tokenAlice } = await playOneGame();

      const res = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?mode=Rapid`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      expect(res.body.games).toHaveLength(0);
    },
    35_000,
  );

  it(
    "@regression pagination: 25 seeded games → page=1 returns 20, page=2 returns 5",
    async () => {
      const tokenAlice = await registerVerifyLogin("alice2@hist.test", "alice_hist2");
      const tokenBob = await registerVerifyLogin("bob2@hist.test", "bob_hist2");

      const prisma = app.get(PrismaService);
      const aliceUser = await prisma.user.findFirst({ where: { nickname: "alice_hist2" } });
      const bobUser = await prisma.user.findFirst({ where: { nickname: "bob_hist2" } });

      // Seed 25 completed games directly via prisma
      const now = new Date();
      await prisma.game.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          mode: "Blitz",
          timeControlMs: 180_000,
          whiteUserId: aliceUser!.id,
          blackUserId: bobUser!.id,
          result: "white_win",
          endReason: "resignation",
          pgn: `[Event "?"][Site "?"]\n1. e4 e5 2. Nf3 *`,
          finalFen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
          whiteRatingBefore: 1500,
          whiteRatingAfter: 1516,
          blackRatingBefore: 1500,
          blackRatingAfter: 1484,
          startedAt: new Date(now.getTime() - (i + 1) * 60_000),
          endedAt: new Date(now.getTime() - i * 60_000),
        })),
      });

      const page1 = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?page=1`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      expect(page1.body.games).toHaveLength(20);
      expect(page1.body.pagination.totalGames).toBe(25);
      expect(page1.body.pagination.totalPages).toBe(2);
      expect(page1.body.pagination.perPage).toBe(20);

      const page2 = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?page=2`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      expect(page2.body.games).toHaveLength(5);
      expect(page2.body.pagination.page).toBe(2);
    },
    20_000,
  );

  it(
    "@regression page=99 clamps to last page",
    async () => {
      const tokenAlice = await registerVerifyLogin("alice3@hist.test", "alice_hist3");
      const tokenBob = await registerVerifyLogin("bob3@hist.test", "bob_hist3");

      const prisma = app.get(PrismaService);
      const aliceUser = await prisma.user.findFirst({ where: { nickname: "alice_hist3" } });
      const bobUser = await prisma.user.findFirst({ where: { nickname: "bob_hist3" } });

      const now = new Date();
      await prisma.game.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          mode: "Blitz",
          timeControlMs: 180_000,
          whiteUserId: aliceUser!.id,
          blackUserId: bobUser!.id,
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
        .get(`${HISTORY_BASE}/users/me/games?page=99`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      // Clamped to page 2 (last page of 25 games at 20/page)
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.games).toHaveLength(5);
    },
    20_000,
  );

  it(
    "@regression perPage param is ignored — always returns 20",
    async () => {
      const tokenAlice = await registerVerifyLogin("alice4@hist.test", "alice_hist4");
      const tokenBob = await registerVerifyLogin("bob4@hist.test", "bob_hist4");

      const prisma = app.get(PrismaService);
      const aliceUser = await prisma.user.findFirst({ where: { nickname: "alice_hist4" } });
      const bobUser = await prisma.user.findFirst({ where: { nickname: "bob_hist4" } });

      const now = new Date();
      await prisma.game.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          mode: "Blitz",
          timeControlMs: 180_000,
          whiteUserId: aliceUser!.id,
          blackUserId: bobUser!.id,
          result: "draw",
          endReason: "agreement",
          pgn: `[Event "?"]\n1. e4 *`,
          finalFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          whiteRatingBefore: 1500,
          whiteRatingAfter: 1500,
          blackRatingBefore: 1500,
          blackRatingAfter: 1500,
          startedAt: new Date(now.getTime() - (i + 1) * 60_000),
          endedAt: new Date(now.getTime() - i * 60_000),
        })),
      });

      // Client sends perPage=5 — server should coerce to 20
      const res = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/users/me/games?page=1&perPage=5`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      expect(res.body.pagination.perPage).toBe(20);
      expect(res.body.games).toHaveLength(20);
    },
    20_000,
  );

  it("@regression guest (no auth) → 401 on list endpoint", async () => {
    await request(app.getHttpServer())
      .get(`${HISTORY_BASE}/users/me/games`)
      .expect(401);
  });

  it("negative: invalid mode param → 400", async () => {
    const token = await registerVerifyLogin("alice5@hist.test", "alice_hist5");
    await request(app.getHttpServer())
      .get(`${HISTORY_BASE}/users/me/games?mode=InvalidMode`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  it("negative: invalid result param → 400", async () => {
    const token = await registerVerifyLogin("alice6@hist.test", "alice_hist6");
    await request(app.getHttpServer())
      .get(`${HISTORY_BASE}/users/me/games?result=invalid`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });
});

describe("[@spec:006-game-history][@regression] GET /games/:gameId — replay endpoint", () => {
  it(
    "@regression alice (participant) gets full replay response with PGN",
    async () => {
      const { tokenAlice, prismaGameId } = await playOneGame();

      const res = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/games/${prismaGameId}`)
        .set("Authorization", `Bearer ${tokenAlice}`)
        .expect(200);

      expect(res.body.gameId).toBe(prismaGameId);
      expect(res.body.pgn).toBeTruthy();
      expect(res.body.white).toBeDefined();
      expect(res.body.white.nickname).toBeTruthy();
      expect(res.body.black).toBeDefined();
      expect(res.body.black.nickname).toBeTruthy();
      expect(["white_win", "black_win", "draw"]).toContain(res.body.result);
      expect(res.body.endReason).toBe("resignation");
    },
    35_000,
  );

  it(
    "@regression charlie (non-participant) gets 403 with GAME_NOT_AVAILABLE code",
    async () => {
      const { prismaGameId } = await playOneGame();
      const tokenCharlie = await registerVerifyLogin("charlie2@hist.test", "charlie_hist2");

      const res = await request(app.getHttpServer())
        .get(`${HISTORY_BASE}/games/${prismaGameId}`)
        .set("Authorization", `Bearer ${tokenCharlie}`)
        .expect(403);

      expect(res.body.error?.code).toBe("GAME_NOT_AVAILABLE");
    },
    35_000,
  );

  it("@regression nonexistent game UUID → 404 with GAME_NOT_AVAILABLE code", async () => {
    const token = await registerVerifyLogin("alice7@hist.test", "alice_hist7");
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const res = await request(app.getHttpServer())
      .get(`${HISTORY_BASE}/games/${nonExistentId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);

    expect(res.body.error?.code).toBe("GAME_NOT_AVAILABLE");
  });

  it("@regression guest → 401 on replay endpoint", async () => {
    await request(app.getHttpServer())
      .get(`${HISTORY_BASE}/games/00000000-0000-0000-0000-000000000000`)
      .expect(401);
  });
});
