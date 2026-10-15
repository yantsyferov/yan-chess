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
const USER = { email: "bob@example.com", nickname: "bob_test", password: "Test1234", confirmPassword: "Test1234" };

async function register(): Promise<string> {
  await request(app.getHttpServer()).post(`${BASE}/register`).send(USER).expect(201);
  return latestToken();
}

describe("[@spec:001-registration-and-login][@regression] §2.2 Email Verification", () => {
  it("happy path: valid token → status verified", async () => {
    const token = await register();
    const res = await request(app.getHttpServer())
      .post(`${BASE}/email/verify`)
      .send({ token })
      .expect(200);
    expect(res.body.status).toBe("verified");
  });

  it("negative: token already used → 410 token_used", async () => {
    const token = await register();
    await request(app.getHttpServer()).post(`${BASE}/email/verify`).send({ token }).expect(200);
    const res = await request(app.getHttpServer())
      .post(`${BASE}/email/verify`)
      .send({ token })
      .expect(410);
    expect(res.body.code).toBe("token_used");
  });

  it("negative: invalid token → 410 token_invalid", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/email/verify`)
      .send({ token: "not-a-real-token" })
      .expect(410);
    expect(res.body.code).toBe("token_invalid");
  });

  it("negative: unverified login → 403 email_not_verified", async () => {
    await register(); // don't verify
    const res = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(403);
    expect(res.body.code).toBe("email_not_verified");
  });

  it("resend: first resend succeeds", async () => {
    await register();
    const res = await request(app.getHttpServer())
      .post(`${BASE}/email/resend`)
      .send({ email: USER.email })
      .expect(200);
    expect(res.body.status).toBe("verification_sent");
  });

  it("negative: resend throttle (1/min) → 429 on second attempt", async () => {
    await register();
    await request(app.getHttpServer()).post(`${BASE}/email/resend`).send({ email: USER.email }).expect(200);
    const res = await request(app.getHttpServer())
      .post(`${BASE}/email/resend`)
      .send({ email: USER.email })
      .expect(429);
    expect(res.body.code).toBe("throttled");
    expect(typeof res.body.retryAfterSec).toBe("number");
  });
});
