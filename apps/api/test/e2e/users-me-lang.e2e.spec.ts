// @layer: integration
// @spec: 012-i18n
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll, latestToken } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const AUTH = "/api/v1/auth";
const USERS = "/api/v1/users";

const USER = {
  email: "langtest@example.com",
  nickname: "langtest",
  password: "Test1234",
  confirmPassword: "Test1234",
  country: "US",
};

async function registerVerifyLogin(payload: typeof USER & { lang?: string }): Promise<string> {
  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send(payload)
    .expect(201);
  const token = latestToken();
  await request(app.getHttpServer())
    .post(`${AUTH}/email/verify`)
    .send({ token })
    .expect(200);
  const res = await request(app.getHttpServer())
    .post(`${AUTH}/login`)
    .send({ email: payload.email, password: payload.password, rememberMe: false })
    .expect(200);
  return res.body.accessToken as string;
}

describe("[@spec:012-i18n] User lang persistence via PATCH /users/me", () => {
  it("registers with lang:es and GET /users/me returns lang:es", async () => {
    const accessToken = await registerVerifyLogin({ ...USER, lang: "es" });

    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.lang).toBe("es");
  });

  it("PATCH /users/me { lang: ru } → 200 with lang:ru, then GET confirms lang:ru", async () => {
    const accessToken = await registerVerifyLogin({ ...USER, lang: "es" });

    const patchRes = await request(app.getHttpServer())
      .patch(`${USERS}/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ lang: "ru" })
      .expect(200);

    expect(patchRes.body.lang).toBe("ru");

    const getRes = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(getRes.body.lang).toBe("ru");
  });

  it("PATCH /users/me with invalid lang → 400", async () => {
    const accessToken = await registerVerifyLogin(USER);

    await request(app.getHttpServer())
      .patch(`${USERS}/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ lang: "fr" })
      .expect(400);
  });

  it("PATCH /users/me without auth → 401", async () => {
    await request(app.getHttpServer())
      .patch(`${USERS}/me`)
      .send({ lang: "ru" })
      .expect(401);
  });

  it("lang is null when not set at registration", async () => {
    const accessToken = await registerVerifyLogin(USER);

    const res = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.lang).toBeNull();
  });
});
