// @layer: e2e
// @spec: 014-play-redesign
// @regression
//
// FTR acceptance e2e file — covers §2.4 rated/unrated queue segregation and
// §2.5 challenge flow with isRated=false end-to-end.
//
// Gaps deferred to /awos:verify Playwright drive:
//   - UI-level rated toggle on /play/online (requires browser + live dev server)
//   - Toast "Shareable link coming soon" visual rendering in browser
//   - /play/friend lobby full visual flow (friend list, challenge view switching)
//   - Rating-change number absent on game-end screen for unrated games

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

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE = "/api/v1/auth";
const FRIENDS_BASE = "/api/v1/friends";
const HISTORY_BASE = "/api/v1/users/me/games";

async function registerVerifyLogin(email: string, nickname: string): Promise<string> {
  await request(app.getHttpServer())
    .post(`${BASE}/register`)
    .send({ email, nickname, password: "Test1234!", confirmPassword: "Test1234!", country: "US" })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${BASE}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${BASE}/login`)
    .send({ email, password: "Test1234!", rememberMe: false })
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

function connectPlaySocket(accessToken: string, port: number): Socket {
  return ioClient(`http://localhost:${port}/play`, {
    auth: { token: `Bearer ${accessToken}` },
    transports: ["websocket"],
    autoConnect: true,
  });
}

function connectFriendsSocket(accessToken: string, port: number): Socket {
  return ioClient(`http://localhost:${port}/friends`, {
    auth: { token: `Bearer ${accessToken}` },
    transports: ["websocket"],
    autoConnect: true,
  });
}

function waitForConnect(socket: Socket, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) { resolve(); return; }
    const t = setTimeout(() => reject(new Error("connect timeout")), timeoutMs);
    socket.once("connect", () => { clearTimeout(t); resolve(); });
    socket.once("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
}

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload); });
  });
}

function rejectIfEvent(socket: Socket, event: string, timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    const t = setTimeout(() => {
      socket.off(event);
      // timeout reached WITHOUT the event firing — that is the expected outcome
    }, timeoutMs);
    socket.once(event, () => {
      clearTimeout(t);
      reject(new Error(`Event "${event}" fired but should NOT have`));
    });
  });
}

function getUserId(accessToken: string): string {
  const payload = JSON.parse(
    Buffer.from(accessToken.split(".")[1]!, "base64url").toString(),
  ) as { sub: string };
  return payload.sub;
}

async function makeFriends(aliceToken: string, bobToken: string): Promise<void> {
  const bobId = getUserId(bobToken);
  const res = await request(app.getHttpServer())
    .post(`${FRIENDS_BASE}/requests`)
    .set("Authorization", `Bearer ${aliceToken}`)
    .send({ userId: bobId })
    .expect(201);
  const { friendshipId } = res.body as { friendshipId: string };
  await request(app.getHttpServer())
    .post(`${FRIENDS_BASE}/requests/${friendshipId}/accept`)
    .set("Authorization", `Bearer ${bobToken}`)
    .expect(201);
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── test suite ──────────────────────────────────────────────────────────────

describe("[@spec:014-play-redesign][@regression] §2.5 Challenge flow with isRated=false", () => {
  it(
    "alice challenges bob (isRated=false) → game persisted with isRated=false → alice's history returns isRated=false → neither rating changes",
    async () => {
      const port = await ensureListening();
      const aliceToken = await registerVerifyLogin("alice_ch@spec014.test", "alice_ch");
      const bobToken = await registerVerifyLogin("bob_ch@spec014.test", "bob_ch");
      const bobId = getUserId(bobToken);

      await makeFriends(aliceToken, bobToken);

      const aliceFriends = connectFriendsSocket(aliceToken, port);
      const bobFriends = connectFriendsSocket(bobToken, port);
      const alicePlay = connectPlaySocket(aliceToken, port);
      const bobPlay = connectPlaySocket(bobToken, port);

      await Promise.all([
        waitForConnect(aliceFriends),
        waitForConnect(bobFriends),
        waitForConnect(alicePlay),
        waitForConnect(bobPlay),
      ]);
      await pause(300); // allow presence to settle

      try {
        const chalReceived = waitForEvent<{ challengeId: string; isRated: boolean }>(
          bobFriends,
          "challenge.received",
        );
        aliceFriends.emit("challenge.send", {
          targetUserId: bobId,
          mode: "Blitz",
          color: "white",
          isRated: false,
        });
        const chalPayload = await chalReceived;
        expect(chalPayload.isRated).toBe(false);

        const aliceGameStart = waitForEvent<{ gameId: string; color: string }>(alicePlay, "game.start");
        const bobGameStart = waitForEvent<{ gameId: string; color: string }>(bobPlay, "game.start");
        bobFriends.emit("challenge.respond", { challengeId: chalPayload.challengeId, accept: true });
        const [aliceGame, bobGame] = await Promise.all([aliceGameStart, bobGameStart]);
        expect(aliceGame.gameId).toBe(bobGame.gameId);
        const { gameId } = aliceGame;

        // Resign to flush the game to Postgres
        const gameEnd = waitForEvent(alicePlay, "game.end");
        const resignerSock = aliceGame.color === "white" ? alicePlay : bobPlay;
        resignerSock.emit("game.resign", { gameId });
        await gameEnd;

        // Verify DB flag
        const prisma = app.get(PrismaService);
        const dbGame = await prisma.game.findFirst({
          where: { OR: [
            { whiteUserId: getUserId(aliceToken), blackUserId: getUserId(bobToken) },
            { whiteUserId: getUserId(bobToken), blackUserId: getUserId(aliceToken) },
          ]},
        });
        expect(dbGame).not.toBeNull();
        expect(dbGame!.isRated).toBe(false);

        // Verify ratings unchanged
        const aliceId = getUserId(aliceToken);
        const bobId2 = getUserId(bobToken);
        const aliceRating = await prisma.ratingByMode.findUnique({
          where: { userId_mode: { userId: aliceId, mode: "Blitz" } },
        });
        const bobRating = await prisma.ratingByMode.findUnique({
          where: { userId_mode: { userId: bobId2, mode: "Blitz" } },
        });
        expect(aliceRating?.rating).toBe(1500);
        expect(bobRating?.rating).toBe(1500);

        // Verify game-history endpoint returns isRated=false
        const histRes = await request(app.getHttpServer())
          .get(HISTORY_BASE)
          .set("Authorization", `Bearer ${aliceToken}`)
          .expect(200);
        const games = (histRes.body as { games: Array<{ isRated: boolean }> }).games;
        expect(games.length).toBeGreaterThan(0);
        expect(games[0]!.isRated).toBe(false);
      } finally {
        aliceFriends.disconnect();
        bobFriends.disconnect();
        alicePlay.disconnect();
        bobPlay.disconnect();
      }
    },
    40_000,
  );
});

describe("[@spec:014-play-redesign][@regression] §2.4 Unrated Blitz queue — matchmaking", () => {
  it(
    "alice and bob both join Blitz UNRATED → they are paired → game has isRated=false → ratings unchanged",
    async () => {
      const port = await ensureListening();
      const aliceToken = await registerVerifyLogin("alice_unq@spec014.test", "alice_unq");
      const bobToken = await registerVerifyLogin("bob_unq@spec014.test", "bob_unq");

      const alicePlay = connectPlaySocket(aliceToken, port);
      const bobPlay = connectPlaySocket(bobToken, port);
      await Promise.all([waitForConnect(alicePlay), waitForConnect(bobPlay)]);

      try {
        const aliceStart = waitForEvent<{ gameId: string; color: string }>(alicePlay, "game.start");
        const bobStart = waitForEvent<{ gameId: string; color: string }>(bobPlay, "game.start");

        alicePlay.emit("queue.join", { mode: "Blitz", isRated: false });
        await pause(100);
        bobPlay.emit("queue.join", { mode: "Blitz", isRated: false });

        const [aliceGame, bobGame] = await Promise.all([aliceStart, bobStart]);
        expect(aliceGame.gameId).toBe(bobGame.gameId);

        // Resign to flush
        const gameEnd = waitForEvent(alicePlay, "game.end");
        const resignerSock = aliceGame.color === "white" ? alicePlay : bobPlay;
        resignerSock.emit("game.resign", { gameId: aliceGame.gameId });
        await gameEnd;

        // DB check
        const prisma = app.get(PrismaService);
        const aliceId = getUserId(aliceToken);
        const bobId = getUserId(bobToken);
        const dbGame = await prisma.game.findFirst({
          where: { OR: [
            { whiteUserId: aliceId, blackUserId: bobId },
            { whiteUserId: bobId, blackUserId: aliceId },
          ]},
        });
        expect(dbGame).not.toBeNull();
        expect(dbGame!.isRated).toBe(false);

        // Ratings must remain at 1500
        const aliceRating = await prisma.ratingByMode.findUnique({
          where: { userId_mode: { userId: aliceId, mode: "Blitz" } },
        });
        const bobRating = await prisma.ratingByMode.findUnique({
          where: { userId_mode: { userId: bobId, mode: "Blitz" } },
        });
        expect(aliceRating?.rating).toBe(1500);
        expect(bobRating?.rating).toBe(1500);
      } finally {
        alicePlay.disconnect();
        bobPlay.disconnect();
      }
    },
    35_000,
  );
});

describe("[@spec:014-play-redesign][@regression] §2.4 Cross-pairing segregation — rated vs unrated NOT matched", () => {
  it(
    "alice joins Blitz RATED; bob joins Blitz UNRATED → they are NOT paired within 2 seconds",
    async () => {
      const port = await ensureListening();
      const aliceToken = await registerVerifyLogin("alice_cross@spec014.test", "alice_cross");
      const bobToken = await registerVerifyLogin("bob_cross@spec014.test", "bob_cross");

      const alicePlay = connectPlaySocket(aliceToken, port);
      const bobPlay = connectPlaySocket(bobToken, port);
      await Promise.all([waitForConnect(alicePlay), waitForConnect(bobPlay)]);

      let alicePaired = false;
      let bobPaired = false;

      alicePlay.once("game.start", () => { alicePaired = true; });
      bobPlay.once("game.start", () => { bobPaired = true; });

      alicePlay.emit("queue.join", { mode: "Blitz", isRated: true });
      await pause(100);
      bobPlay.emit("queue.join", { mode: "Blitz", isRated: false });

      // Wait 2.5 seconds — the pairing worker runs at 1-second intervals;
      // two intervals without a match means segregation works.
      await pause(2500);

      expect(alicePaired).toBe(false);
      expect(bobPaired).toBe(false);

      // Clean up: leave queues so subsequent tests start clean
      alicePlay.emit("queue.leave");
      bobPlay.emit("queue.leave");
      await pause(200);

      alicePlay.disconnect();
      bobPlay.disconnect();
    },
    15_000,
  );
});
