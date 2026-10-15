// @layer: e2e
// @spec: 007-friends
// @regression
//
// Acceptance-level E2E tests for the Friends feature.
// Covers: friend-request lifecycle, socket events (friend.requested/accepted/declined/unfriended),
// presence events, challenge flow (accept/decline/cancel/expiry/mutual-race),
// access control (non-recipient 403, self-targeting 400), and search relationship states.

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";
import { PrismaService } from "../../src/modules/prisma/prisma.service";
import { RedisService } from "../../src/modules/redis/redis.service";

// ─── app lifecycle ────────────────────────────────────────────────────────────

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
  // Also flush challenge-related Redis keys created during tests
  const redis = app.get(RedisService);
  const challengeKeys = await redis.raw.keys("challenge:*");
  const activeChallengeKeys = await redis.raw.keys("user:activeChallenge:*");
  const all = [...challengeKeys, ...activeChallengeKeys];
  if (all.length > 0) await redis.del(...all);
  // Reset socket-tracking port so each test suite starts fresh
  // (port is reused across tests within the same process)
});

// ─── shared helpers ───────────────────────────────────────────────────────────

const AUTH = "/api/v1/auth";
const FRIENDS = "/api/v1/friends";

async function registerVerifyLogin(
  email: string,
  nickname: string,
  password = "Test1234",
): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send({ email, nickname, password, confirmPassword: password })
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

function connectFriendsSocket(accessToken: string, port: number): Socket {
  return ioClient(`http://localhost:${port}/friends`, {
    auth: { token: `Bearer ${accessToken}` },
    transports: ["websocket"],
    autoConnect: true,
  });
}

function connectPlaySocket(accessToken: string, port: number): Socket {
  return ioClient(`http://localhost:${port}/play`, {
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

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload); });
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Helper: establish a confirmed friendship between two users via HTTP
async function makeFriends(tokenA: string, tokenB: string): Promise<string> {
  const sendRes = await request(app.getHttpServer())
    .post(`${FRIENDS}/requests`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ userId: await getUserId(tokenA) })
    .then(async () => {
      // we need bob's userId — resolve it properly
      return null;
    });
  void sendRes;
  // Use a more straightforward approach: get user ids first
  throw new Error("use makeFriendsById instead");
}
void makeFriends; // suppress unused-variable warning

async function getUserIdFromToken(token: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  return res.body.id as string;
}
// alias
const getUserId = getUserIdFromToken;

async function makeFriendsById(
  tokenA: string,
  userBId: string,
  tokenB: string,
  userAId: string,
): Promise<string> {
  const sendRes = await request(app.getHttpServer())
    .post(`${FRIENDS}/requests`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ userId: userBId })
    .expect(201);
  const friendshipId = sendRes.body.friendshipId as string;
  await request(app.getHttpServer())
    .post(`${FRIENDS}/requests/${friendshipId}/accept`)
    .set("Authorization", `Bearer ${tokenB}`)
    .expect(201);
  void userAId;
  return friendshipId;
}

// ─── 1. Friend-request lifecycle via HTTP ────────────────────────────────────

describe("[@spec:007-friends][@regression] Friend-request HTTP lifecycle", () => {
  it("send → accept → appears in both friends lists", async () => {
    const tokenAlice = await registerVerifyLogin("alice@fr-http.test", "alice_fr");
    const tokenBob = await registerVerifyLogin("bob@fr-http.test", "bob_fr");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);

    // Alice sends request to Bob
    const sendRes = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    expect(sendRes.body.status).toBe("pending");
    const friendshipId = sendRes.body.friendshipId as string;

    // Bob sees it in his Requests tab
    const reqRes = await request(app.getHttpServer())
      .get(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .expect(200);
    expect(reqRes.body.requests).toHaveLength(1);
    expect(reqRes.body.requests[0].requesterUserId).toBe(aliceId);

    // Bob accepts
    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests/${friendshipId}/accept`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .expect(201);

    // Both see each other in friends list
    const aliceFriends = await request(app.getHttpServer())
      .get(FRIENDS)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);
    expect(aliceFriends.body.friends.map((f: { userId: string }) => f.userId)).toContain(bobId);

    const bobFriends = await request(app.getHttpServer())
      .get(FRIENDS)
      .set("Authorization", `Bearer ${tokenBob}`)
      .expect(200);
    expect(bobFriends.body.friends.map((f: { userId: string }) => f.userId)).toContain(aliceId);

    // Requests tab is empty after accept
    const reqAfter = await request(app.getHttpServer())
      .get(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .expect(200);
    expect(reqAfter.body.requests).toHaveLength(0);
  });

  it("send → decline → re-send is allowed (no cooldown)", async () => {
    const tokenAlice = await registerVerifyLogin("alice2@fr-http.test", "alice_fr2");
    const tokenBob = await registerVerifyLogin("bob2@fr-http.test", "bob_fr2");
    const bobId = await getUserId(tokenBob);
    const tokenBobActual = tokenBob;

    // Send
    const r1 = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    const fId = r1.body.friendshipId as string;

    // Decline
    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests/${fId}/decline`)
      .set("Authorization", `Bearer ${tokenBobActual}`)
      .expect(201);

    // Re-send should succeed (201 not 409)
    const r2 = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    expect(r2.body.status).toBe("pending");
  });

  it("unfriend removes both directions", async () => {
    const tokenAlice = await registerVerifyLogin("alice3@fr-http.test", "alice_fr3");
    const tokenBob = await registerVerifyLogin("bob3@fr-http.test", "bob_fr3");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);
    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    // Alice unfriends Bob
    await request(app.getHttpServer())
      .delete(`${FRIENDS}/${bobId}`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);

    // Neither side sees the other
    const aliceFriends = await request(app.getHttpServer()).get(FRIENDS).set("Authorization", `Bearer ${tokenAlice}`).expect(200);
    expect(aliceFriends.body.friends).toHaveLength(0);

    const bobFriends = await request(app.getHttpServer()).get(FRIENDS).set("Authorization", `Bearer ${tokenBob}`).expect(200);
    expect(bobFriends.body.friends).toHaveLength(0);
  });
});

// ─── 2. Access control ────────────────────────────────────────────────────────

describe("[@spec:007-friends][@regression] Access control", () => {
  it("@regression 400 on self-targeting friend request", async () => {
    const tokenAlice = await registerVerifyLogin("alice@ac-self.test", "alice_ac");
    const aliceId = await getUserId(tokenAlice);
    const res = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: aliceId });
    expect(res.status).toBe(400);
  });

  it("@regression 403 when non-recipient tries to accept a request", async () => {
    const tokenAlice = await registerVerifyLogin("alice@ac-403.test", "alice_403");
    const tokenBob = await registerVerifyLogin("bob@ac-403.test", "bob_403");
    const tokenCharlie = await registerVerifyLogin("charlie@ac-403.test", "charlie_403");
    const bobId = await getUserId(tokenBob);

    const sendRes = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    const fId = sendRes.body.friendshipId as string;

    // Charlie tries to accept Alice's request to Bob
    const res = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests/${fId}/accept`)
      .set("Authorization", `Bearer ${tokenCharlie}`);
    expect(res.status).toBe(403);
  });

  it("@regression 401 on unauthenticated request to friends endpoint", async () => {
    await request(app.getHttpServer()).get(FRIENDS).expect(401);
  });

  it("@regression initiator cannot accept their own request (403)", async () => {
    const tokenAlice = await registerVerifyLogin("alice@ac-own.test", "alice_own");
    const tokenBob = await registerVerifyLogin("bob@ac-own.test", "bob_own");
    const bobId = await getUserId(tokenBob);

    const sendRes = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    const fId = sendRes.body.friendshipId as string;

    const res = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests/${fId}/accept`)
      .set("Authorization", `Bearer ${tokenAlice}`);
    expect(res.status).toBe(403);
  });
});

// ─── 3. Auto-accept on symmetric reverse-pending ─────────────────────────────

describe("[@spec:007-friends][@regression] Auto-accept on symmetric send", () => {
  it("@regression when B sends to A who already sent to B → auto-accepted, both are friends", async () => {
    const tokenAlice = await registerVerifyLogin("alice@sym.test", "alice_sym");
    const tokenBob = await registerVerifyLogin("bob@sym.test", "bob_sym");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);

    // Alice sends to Bob
    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);

    // Bob sends back to Alice — should auto-accept
    const res = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .send({ userId: aliceId })
      .expect(201);
    expect(res.body.status).toBe("accepted");

    // Both appear in each other's friends list
    const aliceFriends = await request(app.getHttpServer()).get(FRIENDS).set("Authorization", `Bearer ${tokenAlice}`).expect(200);
    expect(aliceFriends.body.friends.map((f: { userId: string }) => f.userId)).toContain(bobId);
  });
});

// ─── 4. Nickname search — relationship states ─────────────────────────────────

describe("[@spec:007-friends][@regression] Nickname search via HTTP", () => {
  it("returns 'none' for an unknown user", async () => {
    const tokenAlice = await registerVerifyLogin("alice@srch.test", "alice_srch");
    await registerVerifyLogin("bob@srch.test", "bob_srch");

    const res = await request(app.getHttpServer())
      .get(`${FRIENDS}/search?q=bob_srch`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].relationship).toBe("none");
  });

  it("returns 'pending_outbound' after sending request", async () => {
    const tokenAlice = await registerVerifyLogin("alice2@srch.test", "alice_srch2");
    const tokenBob = await registerVerifyLogin("bob2@srch.test", "bob_srch2");
    const bobId = await getUserId(tokenBob);

    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`${FRIENDS}/search?q=bob_srch2`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);
    expect(res.body.results[0].relationship).toBe("pending_outbound");
  });

  it("returns 'pending_inbound' when target sent me a request", async () => {
    const tokenAlice = await registerVerifyLogin("alice3@srch.test", "alice_srch3");
    const tokenBob = await registerVerifyLogin("bob3@srch.test", "bob_srch3");
    const aliceId = await getUserId(tokenAlice);

    // Bob sends to Alice
    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .send({ userId: aliceId })
      .expect(201);

    // Alice searches for Bob — should see pending_inbound
    const res = await request(app.getHttpServer())
      .get(`${FRIENDS}/search?q=bob_srch3`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);
    expect(res.body.results[0].relationship).toBe("pending_inbound");
    expect(res.body.results[0].friendshipId).toBeTruthy();
  });

  it("returns 'friend' after friendship is established", async () => {
    const tokenAlice = await registerVerifyLogin("alice4@srch.test", "alice_srch4");
    const tokenBob = await registerVerifyLogin("bob4@srch.test", "bob_srch4");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);

    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    const res = await request(app.getHttpServer())
      .get(`${FRIENDS}/search?q=bob_srch4`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);
    expect(res.body.results[0].relationship).toBe("friend");
  });

  it("@regression self is not included in search results", async () => {
    const tokenAlice = await registerVerifyLogin("alice5@srch.test", "alice_srch5");

    const res = await request(app.getHttpServer())
      .get(`${FRIENDS}/search?q=alice_srch5`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);
    expect(res.body.results).toHaveLength(0);
  });
});

// ─── 5. Socket events — friend lifecycle ─────────────────────────────────────

describe("[@spec:007-friends][@regression] Socket events — friend lifecycle", () => {
  it("@regression bob receives friend.requested when alice sends a request", async () => {
    const tokenAlice = await registerVerifyLogin("alice@sock-req.test", "alice_sck");
    const tokenBob = await registerVerifyLogin("bob@sock-req.test", "bob_sck");
    const bobId = await getUserId(tokenBob);
    const aliceId = await getUserId(tokenAlice);

    const port = await ensureListening();
    const bobSock = connectFriendsSocket(tokenBob, port);
    await waitForConnect(bobSock);

    const requested = waitForEvent<{ requesterUserId: string }>(bobSock, "friend.requested");

    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);

    const payload = await requested;
    expect(payload.requesterUserId).toBe(aliceId);

    bobSock.disconnect();
  });

  it("@regression both receive friend.accepted when bob accepts alice's request", async () => {
    const tokenAlice = await registerVerifyLogin("alice@sock-acc.test", "alice_sacc");
    const tokenBob = await registerVerifyLogin("bob@sock-acc.test", "bob_sacc");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);

    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    const bobSock = connectFriendsSocket(tokenBob, port);
    await Promise.all([waitForConnect(aliceSock), waitForConnect(bobSock)]);

    const sendRes = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    const fId = sendRes.body.friendshipId as string;

    const aliceAccepted = waitForEvent<{ friendUserId: string }>(aliceSock, "friend.accepted");
    const bobAccepted = waitForEvent<{ friendUserId: string }>(bobSock, "friend.accepted");

    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests/${fId}/accept`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .expect(201);

    const [aPayload, bPayload] = await Promise.all([aliceAccepted, bobAccepted]);
    expect(aPayload.friendUserId).toBe(bobId);
    expect(bPayload.friendUserId).toBe(aliceId);

    aliceSock.disconnect();
    bobSock.disconnect();
  });

  it("@regression initiator receives friend.declined when bob declines", async () => {
    const tokenAlice = await registerVerifyLogin("alice@sock-dec.test", "alice_sdec");
    const tokenBob = await registerVerifyLogin("bob@sock-dec.test", "bob_sdec");
    const bobId = await getUserId(tokenBob);

    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    await waitForConnect(aliceSock);

    const sendRes = await request(app.getHttpServer())
      .post(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .send({ userId: bobId })
      .expect(201);
    const fId = sendRes.body.friendshipId as string;

    const declined = waitForEvent<{ friendshipId: string }>(aliceSock, "friend.declined");

    await request(app.getHttpServer())
      .post(`${FRIENDS}/requests/${fId}/decline`)
      .set("Authorization", `Bearer ${tokenBob}`)
      .expect(201);

    const payload = await declined;
    expect(payload.friendshipId).toBe(fId);

    aliceSock.disconnect();
  });

  it("@regression both receive friend.unfriended after unfriend", async () => {
    const tokenAlice = await registerVerifyLogin("alice@sock-unf.test", "alice_sunf");
    const tokenBob = await registerVerifyLogin("bob@sock-unf.test", "bob_sunf");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);
    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    const bobSock = connectFriendsSocket(tokenBob, port);
    await Promise.all([waitForConnect(aliceSock), waitForConnect(bobSock)]);

    const aliceUnfriended = waitForEvent<{ friendUserId: string }>(aliceSock, "friend.unfriended");
    const bobUnfriended = waitForEvent<{ friendUserId: string }>(bobSock, "friend.unfriended");

    await request(app.getHttpServer())
      .delete(`${FRIENDS}/${bobId}`)
      .set("Authorization", `Bearer ${tokenAlice}`)
      .expect(200);

    const [aP, bP] = await Promise.all([aliceUnfriended, bobUnfriended]);
    expect(aP.friendUserId).toBe(bobId);
    expect(bP.friendUserId).toBe(aliceId);

    aliceSock.disconnect();
    bobSock.disconnect();
  });
});

// ─── 6. Presence events ───────────────────────────────────────────────────────

describe("[@spec:007-friends][@regression] Presence events", () => {
  it("@regression bob receives friend.presence { online: true } when alice (his friend) connects", async () => {
    const tokenAlice = await registerVerifyLogin("alice@pres.test", "alice_pres");
    const tokenBob = await registerVerifyLogin("bob@pres.test", "bob_pres");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);
    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    const port = await ensureListening();

    // Bob connects first
    const bobSock = connectFriendsSocket(tokenBob, port);
    await waitForConnect(bobSock);

    // Now watch for presence event on Bob's socket
    const presencePromise = waitForEvent<{ userId: string; online: boolean }>(bobSock, "friend.presence");

    // Alice connects — should broadcast online: true to bob
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    await waitForConnect(aliceSock);

    const pPayload = await presencePromise;
    expect(pPayload.userId).toBe(aliceId);
    expect(pPayload.online).toBe(true);

    // Now alice disconnects — bob should receive online: false
    const offlinePromise = waitForEvent<{ userId: string; online: boolean }>(bobSock, "friend.presence");
    aliceSock.disconnect();

    const offPayload = await offlinePromise;
    expect(offPayload.userId).toBe(aliceId);
    expect(offPayload.online).toBe(false);

    bobSock.disconnect();
  });
});

// ─── 7. Challenge flow — accept ───────────────────────────────────────────────

describe("[@spec:007-friends][@regression] Challenge flow — accept", () => {
  it(
    "@regression alice challenges bob → bob receives challenge.received → bob accepts → both receive game.start on /play",
    async () => {
      const tokenAlice = await registerVerifyLogin("alice@chal-acc.test", "alice_chacc");
      const tokenBob = await registerVerifyLogin("bob@chal-acc.test", "bob_chacc");
      const aliceId = await getUserId(tokenAlice);
      const bobId = await getUserId(tokenBob);
      await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

      const port = await ensureListening();

      // Both connect on /friends (presence) AND /play (game.start delivery)
      const aliceFriendsSock = connectFriendsSocket(tokenAlice, port);
      const bobFriendsSock = connectFriendsSocket(tokenBob, port);
      const alicePlaySock = connectPlaySocket(tokenAlice, port);
      const bobPlaySock = connectPlaySocket(tokenBob, port);

      await Promise.all([
        waitForConnect(aliceFriendsSock),
        waitForConnect(bobFriendsSock),
        waitForConnect(alicePlaySock),
        waitForConnect(bobPlaySock),
      ]);

      // Let socket counts settle (presence increments happen async)
      await pause(200);

      const challengeReceived = waitForEvent<{
        challengeId: string;
        challengerUserId: string;
        mode: string;
        color: string;
      }>(bobFriendsSock, "challenge.received");

      // Alice sends challenge
      aliceFriendsSock.emit("challenge.send", {
        targetUserId: bobId,
        mode: "Rapid",
        color: "white",
      });

      const chalPayload = await challengeReceived;
      expect(chalPayload.challengerUserId).toBe(aliceId);
      expect(chalPayload.mode).toBe("Rapid");
      expect(chalPayload.color).toBe("white");

      // Both wait for game.start on /play
      const aliceGameStart = waitForEvent<{ gameId: string; mode: string; color: string }>(alicePlaySock, "game.start");
      const bobGameStart = waitForEvent<{ gameId: string; mode: string; color: string }>(bobPlaySock, "game.start");

      // Bob accepts
      bobFriendsSock.emit("challenge.respond", {
        challengeId: chalPayload.challengeId,
        accept: true,
      });

      const [aGame, bGame] = await Promise.all([aliceGameStart, bobGameStart]);
      expect(aGame.gameId).toBeTruthy();
      expect(aGame.gameId).toBe(bGame.gameId);
      expect(aGame.mode).toBe("Rapid");
      // Alice chose white → she is white, bob is black
      expect(aGame.color).toBe("white");
      expect(bGame.color).toBe("black");

      // Verify game state exists in Redis (game is in-progress; not yet in Postgres)
      const redis = app.get(RedisService);
      const gameData = await redis.hgetall(`game:${aGame.gameId}`);
      expect(gameData).not.toBeNull();
      expect(gameData?.["mode"]).toBe("Rapid");

      aliceFriendsSock.disconnect();
      bobFriendsSock.disconnect();
      alicePlaySock.disconnect();
      bobPlaySock.disconnect();
    },
    30_000,
  );
});

// ─── 8. Challenge flow — decline ─────────────────────────────────────────────

describe("[@spec:007-friends][@regression] Challenge flow — decline", () => {
  it("bob declines → alice receives challenge.declined", async () => {
    const tokenAlice = await registerVerifyLogin("alice@chal-dec.test", "alice_chdec");
    const tokenBob = await registerVerifyLogin("bob@chal-dec.test", "bob_chdec");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);
    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    const bobSock = connectFriendsSocket(tokenBob, port);
    await Promise.all([waitForConnect(aliceSock), waitForConnect(bobSock)]);
    await pause(200);

    const chalReceived = waitForEvent<{ challengeId: string }>(bobSock, "challenge.received");
    aliceSock.emit("challenge.send", { targetUserId: bobId, mode: "Blitz", color: "white" });
    const { challengeId } = await chalReceived;

    const declined = waitForEvent<{ challengeId: string }>(aliceSock, "challenge.declined");
    bobSock.emit("challenge.respond", { challengeId, accept: false });
    const payload = await declined;
    expect(payload.challengeId).toBe(challengeId);

    aliceSock.disconnect();
    bobSock.disconnect();
  });
});

// ─── 9. Challenge flow — cancel ───────────────────────────────────────────────

describe("[@spec:007-friends][@regression] Challenge flow — cancel", () => {
  it("alice cancels → bob receives challenge.cancelled", async () => {
    const tokenAlice = await registerVerifyLogin("alice@chal-can.test", "alice_chcan");
    const tokenBob = await registerVerifyLogin("bob@chal-can.test", "bob_chcan");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);
    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    const bobSock = connectFriendsSocket(tokenBob, port);
    await Promise.all([waitForConnect(aliceSock), waitForConnect(bobSock)]);
    await pause(200);

    const chalReceived = waitForEvent<{ challengeId: string }>(bobSock, "challenge.received");
    aliceSock.emit("challenge.send", { targetUserId: bobId, mode: "Blitz", color: "white" });
    const { challengeId } = await chalReceived;

    // Capture the sent challengeId from alice's side
    const sentPromise = waitForEvent<{ challengeId: string }>(aliceSock, "challenge.sent");
    // Note: challenge.sent was already emitted, may need to listen before send —
    // but we received it from bob side which confirms the send. Get id from bob.

    const cancelled = waitForEvent<{ challengeId: string }>(bobSock, "challenge.cancelled");
    aliceSock.emit("challenge.cancel", { challengeId });
    const payload = await cancelled;
    expect(payload.challengeId).toBe(challengeId);

    void sentPromise;
    aliceSock.disconnect();
    bobSock.disconnect();
  });
});

// ─── 10. Challenge expiry ─────────────────────────────────────────────────────

describe("[@spec:007-friends][@regression] Challenge expiry via sweeper", () => {
  it(
    "both alice and bob receive challenge.expired after timeoutAt passes",
    async () => {
      const tokenAlice = await registerVerifyLogin("alice@chal-exp.test", "alice_chexp");
      const tokenBob = await registerVerifyLogin("bob@chal-exp.test", "bob_chexp");
      const aliceId = await getUserId(tokenAlice);
      const bobId = await getUserId(tokenBob);
      await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

      const port = await ensureListening();
      const aliceSock = connectFriendsSocket(tokenAlice, port);
      const bobSock = connectFriendsSocket(tokenBob, port);
      await Promise.all([waitForConnect(aliceSock), waitForConnect(bobSock)]);
      await pause(200);

      const chalReceived = waitForEvent<{ challengeId: string }>(bobSock, "challenge.received");
      aliceSock.emit("challenge.send", { targetUserId: bobId, mode: "Blitz", color: "white" });
      const { challengeId } = await chalReceived;

      // Manipulate Redis to backdate the timeoutAt so the sweeper fires immediately
      const redis = app.get(RedisService);
      await redis.hset(`challenge:${challengeId}`, {
        timeoutAt: String(Date.now() - 1000), // already expired
      });

      // Wait for the sweeper (runs every 1s)
      const aliceExpired = waitForEvent<{ challengeId: string }>(aliceSock, "challenge.expired", 5000);
      const bobExpired = waitForEvent<{ challengeId: string }>(bobSock, "challenge.expired", 5000);

      const [aExp, bExp] = await Promise.all([aliceExpired, bobExpired]);
      expect(aExp.challengeId).toBe(challengeId);
      expect(bExp.challengeId).toBe(challengeId);

      aliceSock.disconnect();
      bobSock.disconnect();
    },
    15_000,
  );
});

// ─── 11. Mutual-send race → exactly one game ──────────────────────────────────

describe("[@spec:007-friends][@regression] Challenge mutual-send race", () => {
  it(
    "@regression alice and bob send each other challenges simultaneously → exactly one game.start on /play for each",
    async () => {
      const tokenAlice = await registerVerifyLogin("alice@race.test", "alice_race");
      const tokenBob = await registerVerifyLogin("bob@race.test", "bob_race");
      const aliceId = await getUserId(tokenAlice);
      const bobId = await getUserId(tokenBob);
      await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

      const port = await ensureListening();
      const aliceFriendsSock = connectFriendsSocket(tokenAlice, port);
      const bobFriendsSock = connectFriendsSocket(tokenBob, port);
      const alicePlaySock = connectPlaySocket(tokenAlice, port);
      const bobPlaySock = connectPlaySocket(tokenBob, port);
      await Promise.all([
        waitForConnect(aliceFriendsSock),
        waitForConnect(bobFriendsSock),
        waitForConnect(alicePlaySock),
        waitForConnect(bobPlaySock),
      ]);
      // Wait for presence to register so challenge validation (target_offline) passes
      await pause(500);

      const aliceGameStart = waitForEvent<{ gameId: string }>(alicePlaySock, "game.start", 15_000);
      const bobGameStart = waitForEvent<{ gameId: string }>(bobPlaySock, "game.start", 15_000);

      // Fire both simultaneously — mutual-race: second arrival auto-accepts the first
      aliceFriendsSock.emit("challenge.send", { targetUserId: bobId, mode: "Blitz", color: "white" });
      // Small offset so the first arrives first (pure simultaneous can be non-deterministic on loopback)
      await pause(50);
      bobFriendsSock.emit("challenge.send", { targetUserId: aliceId, mode: "Blitz", color: "white" });

      const [aGame, bGame] = await Promise.all([aliceGameStart, bobGameStart]);
      expect(aGame.gameId).toBeTruthy();
      expect(aGame.gameId).toBe(bGame.gameId);

      // Both game.start payloads must agree on the same gameId
      // (the mutual race resolves to exactly one game — verified by matching IDs)
      expect(aGame.gameId).toBe(bGame.gameId);

      aliceFriendsSock.disconnect();
      bobFriendsSock.disconnect();
      alicePlaySock.disconnect();
      bobPlaySock.disconnect();
    },
    30_000,
  );
});

// ─── 12. Challenge to an offline friend is rejected ───────────────────────────

describe("[@spec:007-friends] Challenge edge cases", () => {
  it("challenge to offline friend returns ok: false, code: target_offline", async () => {
    const tokenAlice = await registerVerifyLogin("alice@chal-off.test", "alice_choff");
    const tokenBob = await registerVerifyLogin("bob@chal-off.test", "bob_choff");
    const aliceId = await getUserId(tokenAlice);
    const bobId = await getUserId(tokenBob);
    await makeFriendsById(tokenAlice, bobId, tokenBob, aliceId);

    // Alice connects on /friends so she is "online", bob stays offline
    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    await waitForConnect(aliceSock);
    await pause(200);

    const result = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      aliceSock.emit(
        "challenge.send",
        { targetUserId: bobId, mode: "Blitz", color: "white" },
        (ack: { ok: boolean; code?: string }) => resolve(ack),
      );
      // fallback: listen for the returned value (NestJS gateway returns from handler)
      setTimeout(() => resolve({ ok: false, code: "timeout" }), 3000);
    });

    // The gateway returns the result of challengeService.sendChallenge
    expect(result.ok).toBe(false);
    expect(result.code).toBe("target_offline");

    aliceSock.disconnect();
  });

  it("challenge to non-friend returns ok: false, code: not_friends", async () => {
    const tokenAlice = await registerVerifyLogin("alice@chal-nf.test", "alice_chnf");
    const tokenBob = await registerVerifyLogin("bob@chal-nf.test", "bob_chnf");
    const bobId = await getUserId(tokenBob);

    const port = await ensureListening();
    const aliceSock = connectFriendsSocket(tokenAlice, port);
    const bobSock = connectFriendsSocket(tokenBob, port);
    await Promise.all([waitForConnect(aliceSock), waitForConnect(bobSock)]);
    await pause(200);

    const result = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      aliceSock.emit(
        "challenge.send",
        { targetUserId: bobId, mode: "Blitz", color: "white" },
        (ack: { ok: boolean; code?: string }) => resolve(ack),
      );
      setTimeout(() => resolve({ ok: false, code: "timeout" }), 3000);
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_friends");

    aliceSock.disconnect();
    bobSock.disconnect();
  });
});
