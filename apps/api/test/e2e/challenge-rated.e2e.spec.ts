// @layer: e2e
// @spec: 014-play-redesign / slice-3
// Verifies that isRated flows from challenge.send → Redis → createGame → DB → game history.
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";
import { PrismaService } from "../../src/modules/prisma/prisma.service";
import { RedisService } from "../../src/modules/redis/redis.service";

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
  const redis = app.get(RedisService);
  const challengeKeys = await redis.raw.keys("challenge:*");
  const activeChallengeKeys = await redis.raw.keys("user:activeChallenge:*");
  const all = [...challengeKeys, ...activeChallengeKeys];
  if (all.length > 0) await redis.del(...all);
  // Do NOT reset serverPort — app.listen(0) cannot be called twice
});

const AUTH = "/api/v1/auth";
const FRIENDS = "/api/v1/friends";
const HISTORY = "/api/v1/users/me/games";

async function registerVerifyLogin(email: string, nickname: string, password = "Test1234"): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send({ email, nickname, password, confirmPassword: password, country: "US" })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${AUTH}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${AUTH}/login`)
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

function connectSocket(namespace: string, accessToken: string, port: number): Socket {
  return ioClient(`http://localhost:${port}/${namespace}`, {
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

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

function getUserId(accessToken: string): string {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1]!, "base64url").toString()) as { sub: string };
  return payload.sub;
}

async function setupFriends(aliceToken: string, bobToken: string): Promise<void> {
  const bobId = getUserId(bobToken);
  // Alice sends request to bob
  const res = await request(app.getHttpServer())
    .post(`${FRIENDS}/requests`)
    .set("Authorization", `Bearer ${aliceToken}`)
    .send({ userId: bobId })
    .expect(201);
  const { friendshipId } = res.body as { friendshipId: string };
  // Bob accepts
  await request(app.getHttpServer())
    .post(`${FRIENDS}/requests/${friendshipId}/accept`)
    .set("Authorization", `Bearer ${bobToken}`)
    .expect(201);
}

async function runChallengeScenario(isRated: boolean): Promise<void> {
  const port = await ensureListening();

  const aliceToken = await registerVerifyLogin("alice_rated@test.com", `alice_r${isRated ? 1 : 0}`);
  const bobToken = await registerVerifyLogin("bob_rated@test.com", `bob_r${isRated ? 1 : 0}`);
  const bobId = getUserId(bobToken);

  await setupFriends(aliceToken, bobToken);

  const aliceFriendsSock = connectSocket("friends", aliceToken, port);
  const bobFriendsSock = connectSocket("friends", bobToken, port);
  const alicePlaySock = connectSocket("play", aliceToken, port);
  const bobPlaySock = connectSocket("play", bobToken, port);

  await Promise.all([
    waitForConnect(aliceFriendsSock),
    waitForConnect(bobFriendsSock),
    waitForConnect(alicePlaySock),
    waitForConnect(bobPlaySock),
  ]);

  // Let presence counts settle (async socket room join)
  await new Promise((r) => setTimeout(r, 300));

  try {
    const chalReceived = waitForEvent<{ challengeId: string; isRated: boolean }>(bobFriendsSock, "challenge.received");
    aliceFriendsSock.emit("challenge.send", { targetUserId: bobId, mode: "Blitz", color: "white", isRated });
    const chalPayload = await chalReceived;

    expect(chalPayload.isRated).toBe(isRated);

    const aliceGameStart = waitForEvent<{ gameId: string; color: string }>(alicePlaySock, "game.start");
    const bobGameStart = waitForEvent<{ gameId: string; color: string }>(bobPlaySock, "game.start");

    bobFriendsSock.emit("challenge.respond", { challengeId: chalPayload.challengeId, accept: true });

    const [aliceGame, bobGame] = await Promise.all([aliceGameStart, bobGameStart]);
    expect(aliceGame.gameId).toBe(bobGame.gameId);
    const { gameId } = aliceGame;

    // Game is in-progress in Redis; resign to flush it to Postgres
    const resignerSock = aliceGame.color === "white" ? alicePlaySock : bobPlaySock;
    const gameEnd = waitForEvent<{ gameId: string }>(alicePlaySock, "game.end");
    resignerSock.emit("game.resign", { gameId });
    await gameEnd;

    // Verify in DB — look up by participants since Prisma auto-generates its own id
    const prisma = app.get(PrismaService);
    const aliceUser = await prisma.user.findFirst({ where: { email: "alice_rated@test.com" } });
    const bobUser = await prisma.user.findFirst({ where: { email: "bob_rated@test.com" } });
    const dbGame = await prisma.game.findFirst({
      where: {
        OR: [
          { whiteUserId: aliceUser!.id, blackUserId: bobUser!.id },
          { whiteUserId: bobUser!.id, blackUserId: aliceUser!.id },
        ],
      },
    });
    expect(dbGame).not.toBeNull();
    expect(dbGame!.isRated).toBe(isRated);

    // Verify game history endpoint
    const historyRes = await request(app.getHttpServer())
      .get(HISTORY)
      .set("Authorization", `Bearer ${aliceToken}`)
      .expect(200);
    const games = (historyRes.body as { games: Array<{ gameId: string; isRated: boolean }> }).games;
    expect(games.length).toBeGreaterThan(0);
    expect(games[0]!.isRated).toBe(isRated);
  } finally {
    aliceFriendsSock.disconnect();
    bobFriendsSock.disconnect();
    alicePlaySock.disconnect();
    bobPlaySock.disconnect();
  }
}

describe("[@spec:014-play-redesign/slice-3][@regression] Challenge isRated end-to-end", () => {
  it("isRated=false → game created with isRated=false → history row isRated=false", async () => {
    await runChallengeScenario(false);
  });

  it("isRated=true → game created with isRated=true → history row isRated=true", async () => {
    await runChallengeScenario(true);
  });
});
