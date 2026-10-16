// @layer: integration
// @spec: 001-registration-and-login
// @regression
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, resetAll } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const BASE = "/api/v1/auth";
const VALID = {
  email: "alice@example.com",
  nickname: "alice_42",
  password: "Secret123",
  confirmPassword: "Secret123",
  country: "US",
};

describe("[@spec:001-registration-and-login][@regression] §2.1 Registration", () => {
  it("happy path: registers and returns verification_sent", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send(VALID)
      .expect(201);
    expect(res.body.status).toBe("verification_sent");
  });

  it("negative: invalid email format → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, email: "not-an-email" })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/email/i);
  });

  it("negative: nickname too short (< 3 chars) → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, nickname: "ab" })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/nickname/i);
  });

  it("negative: nickname too long (> 20 chars) → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, nickname: "a".repeat(21) })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/nickname/i);
  });

  it("negative: nickname with invalid chars → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, nickname: "nick!name" })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/nickname/i);
  });

  it("negative: weak password (no letters) → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, password: "12345678", confirmPassword: "12345678" })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/password/i);
  });

  it("negative: password too short → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, password: "Ab1", confirmPassword: "Ab1" })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/password/i);
  });

  it("negative: confirmPassword mismatch → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, confirmPassword: "Different9" })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/confirm/i);
  });

  it("negative: duplicate email → 409 with field=email", async () => {
    await request(app.getHttpServer()).post(`${BASE}/register`).send(VALID).expect(201);
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, nickname: "other_user" })
      .expect(409);
    expect(res.body.field).toBe("email");
    expect(res.body.code).toBe("email_taken");
  });

  it("negative: duplicate nickname → 409 with field=nickname", async () => {
    await request(app.getHttpServer()).post(`${BASE}/register`).send(VALID).expect(201);
    const res = await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({ ...VALID, email: "other@example.com" })
      .expect(409);
    expect(res.body.field).toBe("nickname");
    expect(res.body.code).toBe("nickname_taken");
  });
});
