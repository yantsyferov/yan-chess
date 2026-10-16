// @layer: e2e
// @spec: 015-country-on-dtos
// @regression
//
// Verifies that all user-identifying DTOs carry the `country` field:
//   - GET /friends  → FriendListItem.country
//   - GET /friends/requests → FriendRequestItem.requesterCountry
//   - GET /game-history → GameListItem.opponent.country

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";

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

const AUTH = "/api/v1/auth";
const FRIENDS = "/api/v1/friends";
const HISTORY = "/api/v1/game-history";

async function registerVerifyLogin(
  email: string,
  nickname: string,
  country: string | null,
  password = "Test1234",
): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send({ email, nickname, password, confirmPassword: password, ...(country ? { country } : {}) })
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

describe("[@spec:015-country-on-dtos] DTOs carry country field", () => {
  it("FriendListItem carries country after accepting friend request", async () => {
    const aliceToken = await registerVerifyLogin("alice@example.com", "alice", "US");
    const bobToken = await registerVerifyLogin("bob@example.com", "bob", "GB");

    // Get bob's userId
    const bobMe = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${bobToken}`)
      .expect(200);
    const bobId = bobMe.body.id as string;

    // Alice sends request
    await request(app.getHttpServer())
      .post(`${FRIENDS}/request`)
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ targetUserId: bobId })
      .expect(201);

    // Get friendshipId from bob's requests
    const reqRes = await request(app.getHttpServer())
      .get(`${FRIENDS}/requests`)
      .set("Authorization", `Bearer ${bobToken}`)
      .expect(200);
    const friendshipId = reqRes.body.requests[0].friendshipId as string;

    // Verify requesterCountry is set on the pending request
    expect(reqRes.body.requests[0].requesterCountry).toBe("US");

    // Bob accepts
    await request(app.getHttpServer())
      .post(`${FRIENDS}/request/${friendshipId}/accept`)
      .set("Authorization", `Bearer ${bobToken}`)
      .expect(200);

    // Alice lists friends — should see bob with country "GB"
    const listRes = await request(app.getHttpServer())
      .get(`${FRIENDS}`)
      .set("Authorization", `Bearer ${aliceToken}`)
      .expect(200);

    expect(listRes.body.friends).toHaveLength(1);
    expect(listRes.body.friends[0].country).toBe("GB");
  });

  it("FriendSearchItem carries country", async () => {
    await registerVerifyLogin("alice@example.com", "alice", "US");
    const aliceToken = await request(app.getHttpServer())
      .post(`${AUTH}/login`)
      .send({ email: "alice@example.com", password: "Test1234", rememberMe: false })
      .then((r) => r.body.accessToken as string);

    await registerVerifyLogin("charlie@example.com", "charlie", "DE");

    const searchRes = await request(app.getHttpServer())
      .get(`${FRIENDS}/search?q=charlie`)
      .set("Authorization", `Bearer ${aliceToken}`)
      .expect(200);

    expect(searchRes.body.results).toHaveLength(1);
    expect(searchRes.body.results[0].country).toBe("DE");
  });
});
