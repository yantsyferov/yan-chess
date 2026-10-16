// @layer: integration
// @spec: 001-registration-and-login
// @regression
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestToken, latestTokenFor } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const BASE = "/api/v1/auth";
const USER = { email: "eve@example.com", nickname: "eve_test", password: "OldPass1", confirmPassword: "OldPass1", country: "US" };

async function registerAndVerify(): Promise<void> {
  await request(app.getHttpServer()).post(`${BASE}/register`).send(USER).expect(201);
  const token = latestToken();
  await request(app.getHttpServer()).post(`${BASE}/email/verify`).send({ token }).expect(200);
}

async function loginGetAccessToken(): Promise<{ accessToken: string; refreshCookie: string }> {
  const res = await request(app.getHttpServer())
    .post(`${BASE}/login`)
    .send({ email: USER.email, password: USER.password, rememberMe: false })
    .expect(200);
  const cookieHeader = res.headers["set-cookie"] as string[] | string;
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  return {
    accessToken: res.body.accessToken as string,
    refreshCookie: cookies.find((c) => c.startsWith("refresh=")) ?? "",
  };
}

describe("[@spec:001-registration-and-login][@regression] §2.5 Password Reset", () => {
  it("happy path: forgot with existing email → same-shape 200", async () => {
    await registerAndVerify();
    const res = await request(app.getHttpServer())
      .post(`${BASE}/password/forgot`)
      .send({ email: USER.email })
      .expect(200);
    expect(res.body.status).toBe("reset_email_sent");
  });

  it("negative: forgot with non-existent email → same-shape 200 (no enumeration)", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/password/forgot`)
      .send({ email: "ghost@example.com" })
      .expect(200);
    expect(res.body.status).toBe("reset_email_sent");
  });

  it("happy path: reset with valid token → password_updated, new password works, old rejected", async () => {
    await registerAndVerify();
    await request(app.getHttpServer()).post(`${BASE}/password/forgot`).send({ email: USER.email }).expect(200);
    const resetToken = latestTokenFor(USER.email);

    const resetRes = await request(app.getHttpServer())
      .post(`${BASE}/password/reset`)
      .send({ token: resetToken, newPassword: "NewPass2", confirmNewPassword: "NewPass2" })
      .expect(200);
    expect(resetRes.body.status).toBe("password_updated");

    // Old password rejected
    await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(401);

    // New password works
    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: "NewPass2", rememberMe: false })
      .expect(200);
    expect(loginRes.body.user.email).toBe(USER.email);
  });

  it("negative: reset kills existing sessions → old refresh invalid", async () => {
    await registerAndVerify();
    const { accessToken, refreshCookie } = await loginGetAccessToken();
    void accessToken; // we'll check refresh

    await request(app.getHttpServer()).post(`${BASE}/password/forgot`).send({ email: USER.email }).expect(200);
    const resetToken = latestTokenFor(USER.email);
    await request(app.getHttpServer())
      .post(`${BASE}/password/reset`)
      .send({ token: resetToken, newPassword: "NewPass2", confirmNewPassword: "NewPass2" })
      .expect(200);

    // old refresh cookie must no longer work
    const refreshRes = await request(app.getHttpServer())
      .post(`${BASE}/refresh`)
      .set("Cookie", refreshCookie)
      .expect(401);
    expect(refreshRes.body.code).toMatch(/invalid_refresh|no_refresh/);
  });

  it("negative: old JWT rejected after password reset via pwdEpoch", async () => {
    await registerAndVerify();
    const { accessToken } = await loginGetAccessToken();

    await request(app.getHttpServer()).post(`${BASE}/password/forgot`).send({ email: USER.email }).expect(200);
    const resetToken = latestTokenFor(USER.email);
    await request(app.getHttpServer())
      .post(`${BASE}/password/reset`)
      .send({ token: resetToken, newPassword: "NewPass2", confirmNewPassword: "NewPass2" })
      .expect(200);

    // old access token must be rejected by pwdEpoch check
    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });

  it("negative: expired/used reset token → 410", async () => {
    await registerAndVerify();
    await request(app.getHttpServer()).post(`${BASE}/password/forgot`).send({ email: USER.email }).expect(200);
    const resetToken = latestTokenFor(USER.email);

    // Use it once
    await request(app.getHttpServer())
      .post(`${BASE}/password/reset`)
      .send({ token: resetToken, newPassword: "NewPass2", confirmNewPassword: "NewPass2" })
      .expect(200);

    // Second use → 410 token_used
    const res = await request(app.getHttpServer())
      .post(`${BASE}/password/reset`)
      .send({ token: resetToken, newPassword: "AnotherP3", confirmNewPassword: "AnotherP3" })
      .expect(410);
    expect(res.body.code).toBe("token_used");
  });

  it("negative: invalid reset token → 410 token_invalid", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/password/reset`)
      .send({ token: "fake-token", newPassword: "NewPass2", confirmNewPassword: "NewPass2" })
      .expect(410);
    expect(res.body.code).toBe("token_invalid");
  });
});
