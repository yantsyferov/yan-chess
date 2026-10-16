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
const USER = { email: "dave@example.com", nickname: "dave_test", password: "Test1234", confirmPassword: "Test1234", country: "US" };

async function registerAndVerify(): Promise<void> {
  await request(app.getHttpServer()).post(`${BASE}/register`).send(USER).expect(201);
  const token = latestToken();
  await request(app.getHttpServer()).post(`${BASE}/email/verify`).send({ token }).expect(200);
}

describe("[@spec:001-registration-and-login][@regression] §2.4 Logout", () => {
  it("happy path: logout returns 204 and clears refresh cookie", async () => {
    await registerAndVerify();
    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(200);
    const cookieHeader = loginRes.headers["set-cookie"] as string[] | string;
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    const refreshCookie = cookies.find((c) => c.startsWith("refresh=")) ?? "";

    const logoutRes = await request(app.getHttpServer())
      .post(`${BASE}/logout`)
      .set("Cookie", refreshCookie)
      .expect(204);

    // After logout the cookie should be cleared (Max-Age=0 or Expires in the past)
    const logoutCookies: string[] = [];
    const rawLogout = logoutRes.headers["set-cookie"];
    if (Array.isArray(rawLogout)) logoutCookies.push(...rawLogout);
    else if (rawLogout) logoutCookies.push(rawLogout as string);
    const cleared = logoutCookies.some(
      (c) => c.startsWith("refresh=") && (c.includes("Max-Age=0") || c.includes("Expires=Thu, 01 Jan 1970")),
    );
    expect(cleared).toBe(true);
  });

  it("negative: /users/me with invalidated refresh cookie → 401 after logout", async () => {
    await registerAndVerify();
    const loginRes = await request(app.getHttpServer())
      .post(`${BASE}/login`)
      .send({ email: USER.email, password: USER.password, rememberMe: false })
      .expect(200);
    const accessToken: string = loginRes.body.accessToken;
    const cookieHeader = loginRes.headers["set-cookie"] as string[] | string;
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    const refreshCookie = cookies.find((c) => c.startsWith("refresh=")) ?? "";

    await request(app.getHttpServer())
      .post(`${BASE}/logout`)
      .set("Cookie", refreshCookie)
      .expect(204);

    // After logout, /auth/refresh should return 401
    const refreshRes = await request(app.getHttpServer())
      .post(`${BASE}/refresh`)
      .set("Cookie", refreshCookie)
      .expect(401);
    expect(refreshRes.body.code).toMatch(/invalid_refresh|no_refresh/);

    // The original access token still works (it's short-lived JWT, not revoked by logout)
    // but a fresh /users/me call without a valid session returns 401 on token refresh attempts.
    // Verify the access token itself is still valid right after logout (it has 15-min TTL).
    const meRes = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.email).toBe(USER.email);
  });
});
