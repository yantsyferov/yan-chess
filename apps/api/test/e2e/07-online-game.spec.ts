// @layer: integration
// @spec: 004-matchmaking-and-online-game
// @regression
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";
import { PrismaService } from "../../src/modules/prisma/prisma.service";
import { RedisService } from "../../src/modules/redis/redis.service";

let app: INestApplication;

beforeAll(async () => {
  app = await bootTestApp();
  serverPort = null; // will be set on first ensureListening call
});
afterAll(async () => {
  serverPort = null;
  await app.close();
});
beforeEach(async () => {
  await resetAll(app);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const BASE = "/api/v1/auth";

async function registerVerifyLogin(
  email: string,
  nickname: string,
  password = "Test1234",
): Promise<string> {
  await request(app.getHttpServer())
    .post(`${BASE}/register`)
    .send({ email, nickname, password, confirmPassword: password })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${BASE}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${BASE}/login`)
    .send({ email, password, rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

let serverPort: number | null = null;

async function ensureListening(server: INestApplication): Promise<number> {
  if (serverPort !== null) return serverPort;
  await server.listen(0); // port 0 = OS assigns a free port
  const addr = (server.getHttpServer() as import("http").Server).address() as { port: number };
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

function waitForEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 8000,
): Promise<T> {
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

// ─── tests ────────────────────────────────────────────────────────────────────

describe("[@spec:004-matchmaking-and-online-game][@regression] Full online game flow", () => {
  it(
    "@regression two players join queue → game.start → legal move → game.state → resign → game.end → DB updated",
    async () => {
      // 1. Register and log in two players
      const tokenAlice = await registerVerifyLogin("alice@online.test", "alice_online");
      const tokenBob = await registerVerifyLogin("bob@online.test", "bob_online");

      // 2. Connect both over WebSocket
      const port = await ensureListening(app);
      const sockAlice = connectSocket(tokenAlice, port);
      const sockBob = connectSocket(tokenBob, port);

      // Wait for both sockets to connect
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

      // 3. Both join matchmaking queue for Blitz
      const aliceStart = waitForEvent<{
        gameId: string;
        color: string;
        clocks: { whiteMs: number; blackMs: number };
        fen: string;
      }>(sockAlice, "game.start");
      const bobStart = waitForEvent<{
        gameId: string;
        color: string;
        clocks: { whiteMs: number; blackMs: number };
        fen: string;
      }>(sockBob, "game.start");

      sockAlice.emit("queue.join", { mode: "Blitz" });
      await pause(100);
      sockBob.emit("queue.join", { mode: "Blitz" });

      const [aliceStartPayload, bobStartPayload] = await Promise.all([aliceStart, bobStart]);

      // 4. Verify game.start payloads
      expect(aliceStartPayload.gameId).toBeTruthy();
      expect(bobStartPayload.gameId).toBe(aliceStartPayload.gameId);
      expect(aliceStartPayload.clocks.whiteMs).toBe(180_000);
      expect(aliceStartPayload.clocks.blackMs).toBe(180_000);
      expect(aliceStartPayload.fen).toContain("rnbqkbnr"); // starting position

      const gameId = aliceStartPayload.gameId;

      // 5. The player who got white makes the first move (e2-e4)
      const whiteSocket = aliceStartPayload.color === "white" ? sockAlice : sockBob;
      const blackSocket = aliceStartPayload.color === "white" ? sockBob : sockAlice;

      const aliceState = waitForEvent<{ fen: string; san: string; sideToMove: string }>(
        sockAlice, "game.state",
      );
      const bobState = waitForEvent<{ fen: string; san: string; sideToMove: string }>(
        sockBob, "game.state",
      );

      whiteSocket.emit("game.move", { gameId, from: "e2", to: "e4" });

      const [aliceStatePayload, bobStatePayload] = await Promise.all([aliceState, bobState]);

      // 6. Verify game.state payloads
      expect(aliceStatePayload.san).toBe("e4");
      expect(aliceStatePayload.sideToMove).toBe("black"); // turn switched
      expect(bobStatePayload.san).toBe("e4");

      // 7. Black resigns
      const aliceEnd = waitForEvent<{
        result: string;
        endReason: string;
        ratingDeltas: { white: number; black: number } | null;
        ratingsAfter: { white: number; black: number } | null;
      }>(sockAlice, "game.end");
      const bobEnd = waitForEvent<{
        result: string;
        endReason: string;
        ratingDeltas: { white: number; black: number } | null;
        ratingsAfter: { white: number; black: number } | null;
      }>(sockBob, "game.end");

      blackSocket.emit("game.resign", { gameId });

      const [aliceEndPayload, bobEndPayload] = await Promise.all([aliceEnd, bobEnd]);

      // 8. Verify game.end payloads
      expect(aliceEndPayload.result).toBe("white_win");
      expect(aliceEndPayload.endReason).toBe("resignation");
      expect(bobEndPayload.result).toBe("white_win");

      // Rating deltas should be non-null (equal ratings → ±16 for K=32)
      expect(aliceEndPayload.ratingDeltas).not.toBeNull();
      if (aliceEndPayload.ratingDeltas) {
        expect(aliceEndPayload.ratingDeltas.white).toBe(16);
        expect(aliceEndPayload.ratingDeltas.black).toBe(-16);
      }

      // 9. Verify Postgres game row exists and is completed
      // Note: the Redis game UUID is separate from the Prisma auto-generated UUID.
      // We look up the game by the users involved.
      const prisma = app.get(PrismaService);
      const aliceUser = await prisma.user.findFirst({ where: { nickname: "alice_online" } });
      const bobUser = await prisma.user.findFirst({ where: { nickname: "bob_online" } });
      expect(aliceUser).not.toBeNull();
      expect(bobUser).not.toBeNull();

      const gameRow = await prisma.game.findFirst({
        where: {
          OR: [
            { whiteUserId: aliceUser!.id, blackUserId: bobUser!.id },
            { whiteUserId: bobUser!.id, blackUserId: aliceUser!.id },
          ],
        },
      });
      expect(gameRow).not.toBeNull();
      expect(gameRow?.result).toBe("white_win");
      expect(gameRow?.endReason).toBe("resignation");

      // 10. Verify RatingByMode rows were updated for both players (gamesPlayed incremented)
      const aliceRating = await prisma.ratingByMode.findUnique({
        where: { userId_mode: { userId: aliceUser!.id, mode: "Blitz" } },
      });
      const bobRating = await prisma.ratingByMode.findUnique({
        where: { userId_mode: { userId: bobUser!.id, mode: "Blitz" } },
      });

      expect(aliceRating?.gamesPlayed).toBe(1);
      expect(bobRating?.gamesPlayed).toBe(1);

      // White's rating should have gone up by 16 (from 1500), black's down by 16
      const whiteRating = aliceStartPayload.color === "white" ? aliceRating : bobRating;
      const blackRating = aliceStartPayload.color === "white" ? bobRating : aliceRating;
      expect(whiteRating?.rating).toBe(1516);
      expect(blackRating?.rating).toBe(1484);

      sockAlice.disconnect();
      sockBob.disconnect();
    },
    30_000,
  );

  it("@regression negative: game.move emitted by the wrong side is rejected", async () => {
    const tokenAlice = await registerVerifyLogin("alice2@online.test", "alice_online2");
    const tokenBob = await registerVerifyLogin("bob2@online.test", "bob_online2");

    const port = await ensureListening(app);
    const sockAlice = connectSocket(tokenAlice, port);
    const sockBob = connectSocket(tokenBob, port);

    await Promise.all([
      new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error("connect timeout")), 5000);
        sockAlice.on("connect", () => { clearTimeout(t); res(); });
      }),
      new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error("connect timeout")), 5000);
        sockBob.on("connect", () => { clearTimeout(t); res(); });
      }),
    ]);

    const aliceStart = waitForEvent<{ gameId: string; color: string }>(sockAlice, "game.start");
    const bobStart = waitForEvent<{ gameId: string; color: string }>(sockBob, "game.start");

    sockAlice.emit("queue.join", { mode: "Blitz" });
    await pause(100);
    sockBob.emit("queue.join", { mode: "Blitz" });

    const [aliceStartPayload, bobStartPayload] = await Promise.all([aliceStart, bobStart]);
    const gameId = aliceStartPayload.gameId;

    // Black attempts to move first (wrong turn)
    const blackSocket = aliceStartPayload.color === "black" ? sockAlice : sockBob;
    const blackMoveRejected = waitForEvent<{ reason: string }>(blackSocket, "game.moveRejected", 5000);

    blackSocket.emit("game.move", { gameId, from: "e7", to: "e5" });

    const rejection = await blackMoveRejected;
    expect(rejection.reason).toBeTruthy(); // wrong_turn or similar

    sockAlice.disconnect();
    sockBob.disconnect();
  }, 30_000);
});
