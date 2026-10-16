// @layer: integration
// @spec: 014-play-redesign
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

const BASE = "/api/v1/auth";

async function registerVerifyLogin(email: string, nickname: string): Promise<string> {
  await request(app.getHttpServer())
    .post(`${BASE}/register`)
    .send({ email, nickname, password: "Test1234", confirmPassword: "Test1234" })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${BASE}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${BASE}/login`)
    .send({ email, password: "Test1234", rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

async function ensureListening(server: INestApplication): Promise<number> {
  if (serverPort !== null) return serverPort;
  await server.listen(0);
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

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for "${event}"`));
    }, timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function waitConnect(sock: Socket): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("connect timeout")), 5000);
    sock.on("connect", () => { clearTimeout(t); res(); });
    sock.on("connect_error", (e) => { clearTimeout(t); rej(e); });
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function playFullGame(
  tokenA: string,
  tokenB: string,
  isRated: boolean,
  port: number,
): Promise<string> {
  const sockA = connectSocket(tokenA, port);
  const sockB = connectSocket(tokenB, port);

  await Promise.all([waitConnect(sockA), waitConnect(sockB)]);

  const aStart = waitForEvent<{ gameId: string; color: string }>(sockA, "game.start");
  const bStart = waitForEvent<{ gameId: string; color: string }>(sockB, "game.start");

  sockA.emit("queue.join", { mode: "Blitz", isRated });
  await pause(100);
  sockB.emit("queue.join", { mode: "Blitz", isRated });

  const [aStartPayload, bStartPayload] = await Promise.all([aStart, bStart]);
  const gameId = aStartPayload.gameId;
  expect(bStartPayload.gameId).toBe(gameId);

  // Black resigns immediately
  const aEnd = waitForEvent(sockA, "game.end");
  const bEnd = waitForEvent(sockB, "game.end");

  const whiteSocket = aStartPayload.color === "white" ? sockA : sockB;
  const blackSocket = aStartPayload.color === "white" ? sockB : sockA;

  // White makes one move then black resigns
  whiteSocket.emit("game.move", { gameId, from: "e2", to: "e4" });
  await pause(200);
  blackSocket.emit("game.resign", { gameId });

  await Promise.all([aEnd, bEnd]);

  sockA.disconnect();
  sockB.disconnect();

  return gameId;
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("[@spec:014-play-redesign][@regression] game-rated-flag e2e", () => {
  it(
    "rated Blitz queue → persisted game has isRated=true AND ratings are updated",
    async () => {
      const tokenA = await registerVerifyLogin("alice.rated@rated.test", "alice_rated");
      const tokenB = await registerVerifyLogin("bob.rated@rated.test", "bob_rated");
      const port = await ensureListening(app);

      await playFullGame(tokenA, tokenB, true, port);

      const prisma = app.get(PrismaService);
      const alice = await prisma.user.findFirst({ where: { nickname: "alice_rated" } });
      const bob = await prisma.user.findFirst({ where: { nickname: "bob_rated" } });
      expect(alice).not.toBeNull();
      expect(bob).not.toBeNull();

      const gameRow = await prisma.game.findFirst({
        where: {
          OR: [
            { whiteUserId: alice!.id, blackUserId: bob!.id },
            { whiteUserId: bob!.id, blackUserId: alice!.id },
          ],
        },
      });
      expect(gameRow).not.toBeNull();
      expect(gameRow!.isRated).toBe(true);

      // Ratings must have changed for at least one player
      const aliceRating = await prisma.ratingByMode.findUnique({
        where: { userId_mode: { userId: alice!.id, mode: "Blitz" } },
      });
      const bobRating = await prisma.ratingByMode.findUnique({
        where: { userId_mode: { userId: bob!.id, mode: "Blitz" } },
      });
      expect(aliceRating?.gamesPlayed).toBe(1);
      expect(bobRating?.gamesPlayed).toBe(1);
      // Ratings should have moved from 1500
      const bothUnchanged = aliceRating?.rating === 1500 && bobRating?.rating === 1500;
      expect(bothUnchanged).toBe(false);
    },
    35_000,
  );

  it(
    "unrated Blitz queue → persisted game has isRated=false AND ratings are NOT updated",
    async () => {
      const tokenA = await registerVerifyLogin("alice.unrated@unrated.test", "alice_unrated");
      const tokenB = await registerVerifyLogin("bob.unrated@unrated.test", "bob_unrated");
      const port = await ensureListening(app);

      await playFullGame(tokenA, tokenB, false, port);

      const prisma = app.get(PrismaService);
      const alice = await prisma.user.findFirst({ where: { nickname: "alice_unrated" } });
      const bob = await prisma.user.findFirst({ where: { nickname: "bob_unrated" } });
      expect(alice).not.toBeNull();
      expect(bob).not.toBeNull();

      const gameRow = await prisma.game.findFirst({
        where: {
          OR: [
            { whiteUserId: alice!.id, blackUserId: bob!.id },
            { whiteUserId: bob!.id, blackUserId: alice!.id },
          ],
        },
      });
      expect(gameRow).not.toBeNull();
      expect(gameRow!.isRated).toBe(false);

      // Ratings must NOT have changed
      const aliceRating = await prisma.ratingByMode.findUnique({
        where: { userId_mode: { userId: alice!.id, mode: "Blitz" } },
      });
      const bobRating = await prisma.ratingByMode.findUnique({
        where: { userId_mode: { userId: bob!.id, mode: "Blitz" } },
      });
      expect(aliceRating?.rating).toBe(1500);
      expect(bobRating?.rating).toBe(1500);
    },
    35_000,
  );
});
