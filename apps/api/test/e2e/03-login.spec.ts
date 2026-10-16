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
const USER = { email: "carol@example.com", nickname: "carol_test", password: "Test1234", confirmPassword: "Test1234", country: "US" };

async function registerAndVerify(): Promise<void> {
  await request(app.getHttpServer()).post(`${BASE}/register`).send(USER).expect(201);
  const token = latestToken();
  await request(app.getHttpServer()).post(`${BASE}/email/verify`).send({ token }).expect(200);
}

describe("[@spec:001-registration-and-login][@regression] §2.3 Login", () => {
  it("happy path: verified account → 200 with accessToken + user", async () => {
    await registerAndVerify();
    const res = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.email).toBe(USER.email);
    expect(res.body.user.nickname).toBe(USER.nickname);
    // refresh cookie set
    const cookieHeader = res.headers["set-cookie"] as string[] | string | undefined;
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : (cookieHeader ? [cookieHeader] : []);
    expect(cookies.some((c) => c.startsWith("refresh="))).toBe(true);
  });

  it("negative: wrong password → 401 invalid_credentials", async () => {
    await registerAndVerify();
    const res = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: "WrongPass9", rememberMe: false })
      .expect(401);
    expect(res.body.code).toBe("invalid_credentials");
  });

  it("negative: unknown email → same shape 401 invalid_credentials (no enumeration)", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: "nobody@example.com", password: "Test1234", rememberMe: false })
      .expect(401);
    expect(res.body.code).toBe("invalid_credentials");
  });

  it("negative: lockout after 5 failures — 6th attempt returns 429 even with correct password", async () => {
    await registerAndVerify();
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ email: USER.email, password: "WrongPass9", rememberMe: false })
        .expect(401);
    }
    const res = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(429);
    expect(res.body.code).toBe("locked");
    expect(typeof res.body.retryAfterSec).toBe("number");
  });
});
