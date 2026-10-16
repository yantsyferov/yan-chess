// @layer: integration
// @spec: 001-registration-and-login
// @regression
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestToken } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const BASE = "/api/v1/auth";
const USER = { email: "frank@example.com", nickname: "frank_test", password: "Test1234", confirmPassword: "Test1234", country: "US" };

async function registerVerifyLogin(): Promise<string> {
  await request(app.getHttpServer()).post(`${BASE}/register`).send(USER).expect(201);
  const token = latestToken();
  await request(app.getHttpServer()).post(`${BASE}/email/verify`).send({ token }).expect(200);
  const res = await request(app.getHttpServer())
    .post(`${BASE}/login`)
    .send({ email: USER.email, password: USER.password, rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

describe("[@spec:001-registration-and-login][@regression] §2.6 Profile & Starting Ratings", () => {
  it("first login creates 4 ratings at 1500/0 in Bullet→Blitz→Rapid→Classical order", async () => {
    const accessToken = await registerVerifyLogin();
    const res = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const ratings: { mode: string; rating: number; gamesPlayed: number }[] = res.body.ratings;
    expect(ratings).toHaveLength(4);

    const modes = ratings.map((r) => r.mode);
    expect(modes).toEqual(["Bullet", "Blitz", "Rapid", "Classical"]);

    for (const r of ratings) {
      expect(r.rating).toBe(1500);
      expect(r.gamesPlayed).toBe(0);
    }
  });

  it("second login does not duplicate ratings (idempotent createMany)", async () => {
    // First login
    await registerVerifyLogin();
    // Second login
    const res2 = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(200);
    const accessToken2: string = res2.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken2}`)
      .expect(200);
    expect(meRes.body.ratings).toHaveLength(4);
  });

  it("negative: /users/me without auth → 401", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .expect(401);
  });

  it("profile contains nickname, email, createdAt, avatar:null", async () => {
    const accessToken = await registerVerifyLogin();
    const res = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.nickname).toBe(USER.nickname);
    expect(res.body.email).toBe(USER.email);
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.avatar).toBeNull();
  });
});
