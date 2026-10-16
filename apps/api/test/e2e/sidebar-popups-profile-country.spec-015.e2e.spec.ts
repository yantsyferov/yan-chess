// @layer: e2e
// @spec: 015-sidebar-popups-profile-country
// @regression
//
// Acceptance-level API tests for spec-015 covering:
// - §2.6 Register with country=MX → GET /users/me returns country=MX
// - §2.8 PATCH /users/me { country: null } → unset path returns null
// - §2.7 Register without country → 400 with country-field error
// - §2.7 PATCH /users/me { country: "USA" } → 400 (wrong length, schema requires 2 chars)

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); }, 30_000);
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const AUTH = "/api/v1/auth";
const USERS = "/api/v1/users";

async function registerVerifyLogin(
  email: string,
  nickname: string,
  country: string,
): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send({ email, nickname, password: "Test1234!", confirmPassword: "Test1234!", country })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${AUTH}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${AUTH}/login`)
    .send({ email, password: "Test1234!", rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

describe("[@spec:015][@regression] country field — API acceptance", () => {
  // ── §2.6 Register with country ────────────────────────────────────────────

  it("register with country=MX → GET /users/me returns country: MX", async () => {
    const token = await registerVerifyLogin("mx@spec015.test", "user_015_mx", "MX");
    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.country).toBe("MX");
  });

  // ── §2.8 PATCH country null — unset path ──────────────────────────────────

  // @regression
  it("PATCH /users/me { country: null } → GET /users/me returns country: null", async () => {
    const token = await registerVerifyLogin("null@spec015.test", "user_015_null", "US");

    await request(app.getHttpServer())
      .patch(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .send({ country: null })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.country).toBeNull();
  });

  // ── §2.7 Register without country → 400 ──────────────────────────────────

  // @regression
  it("register without country → 400 with validation error referencing country field", async () => {
    const res = await request(app.getHttpServer())
      .post(`${AUTH}/register`)
      .send({
        email: "nocountry@spec015.test",
        nickname: "user_015_nc",
        password: "Test1234!",
        confirmPassword: "Test1234!",
        // country intentionally omitted
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/country/i);
  });

  // ── §2.7 PATCH invalid country code (wrong length) → 400 ─────────────────

  // @regression
  it("PATCH /users/me { country: 'USA' } → 400 (3-char code rejected by .length(2) schema)", async () => {
    const token = await registerVerifyLogin("bad@spec015.test", "user_015_bad", "DE");

    const res = await request(app.getHttpServer())
      .patch(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .send({ country: "USA" })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/country/i);
  });
});
