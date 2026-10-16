// @layer: e2e
// @spec: 015-sidebar-popups-profile-country / slice-1
// @regression
//
// Verifies:
// 1. register with country=MX → GET /users/me returns country: "MX"
// 2. PATCH /users/me { country: "FR" } → GET returns country: "FR"
// 3. register without country → 400 validation error
// 4. user with country=null (via direct DB null-out) → GET /users/me returns country: null

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestTokenFor } from "./setup";
import { PrismaService } from "../../src/modules/prisma/prisma.service";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); }, 30_000);
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const AUTH = "/api/v1/auth";
const USERS = "/api/v1/users";

async function registerVerifyLogin(email: string, nickname: string, country: string): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send({ email, nickname, password: "Test1234", confirmPassword: "Test1234", country })
    .expect(201);
  const token = latestTokenFor(email);
  await request(app.getHttpServer())
    .post(`${AUTH}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${AUTH}/login`)
    .send({ email, password: "Test1234", rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

describe("[@spec:015-slice-1][@regression] country on /users/me", () => {
  it("register with country=MX → GET /users/me returns country: MX", async () => {
    const token = await registerVerifyLogin("mx-user@country.test", "mx_user", "MX");
    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.country).toBe("MX");
  });

  it("PATCH /users/me { country: FR } → GET /users/me returns country: FR", async () => {
    const token = await registerVerifyLogin("fr-user@country.test", "fr_user", "MX");

    await request(app.getHttpServer())
      .patch(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .send({ country: "FR" })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.country).toBe("FR");
  });

  it("register without country → 400 validation error", async () => {
    const res = await request(app.getHttpServer())
      .post(`${AUTH}/register`)
      .send({
        email: "no-country@country.test",
        nickname: "no_country",
        password: "Test1234",
        confirmPassword: "Test1234",
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/country/i);
  });

  it("user with country=null (DB-nulled) → GET /users/me returns country: null", async () => {
    const token = await registerVerifyLogin("null-country@country.test", "null_country", "US");

    const prisma = app.get(PrismaService);
    await prisma.user.updateMany({
      where: { email: "null-country@country.test" },
      data: { country: null },
    });

    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.country).toBeNull();
  });
});
