// @layer: e2e
// @spec: 012-i18n
// @regression
//
// Acceptance-level e2e tests for spec 012-i18n §2.7:
// "forgot-password for a user whose User.lang === 'es' produces an outbox
//  file with Spanish subject."
//
// Also covers: User.lang === null → forgot-password email arrives in English.
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bootTestApp, resetAll, OUTBOX, latestToken } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); }, 30_000);
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const AUTH = "/api/v1/auth";
const USERS = "/api/v1/users";

function latestOutboxMessage(): { subject: string; html: string } {
  const files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error("No outbox files found");
  const latest = files[files.length - 1]!;
  return JSON.parse(readFileSync(join(OUTBOX, latest), "utf8")) as {
    subject: string;
    html: string;
  };
}

async function registerVerifyLoginWithLang(
  email: string,
  nickname: string,
  lang?: string,
): Promise<string> {
  const payload: Record<string, string> = {
    email,
    nickname,
    password: "Secret123",
    confirmPassword: "Secret123",
    country: "US",
  };
  if (lang) payload["lang"] = lang;

  await request(app.getHttpServer())
    .post(`${AUTH}/register`)
    .send(payload)
    .expect(201);

  const verifyToken = latestToken();
  await request(app.getHttpServer())
    .post(`${AUTH}/email/verify`)
    .send({ token: verifyToken })
    .expect(200);

  const loginRes = await request(app.getHttpServer())
    .post(`${AUTH}/login`)
    .send({ email, password: "Secret123", rememberMe: false })
    .expect(200);

  return loginRes.body.accessToken as string;
}

describe("§2.7 — Forgot-password email locale", () => {
  // @regression
  it("user with lang='es' receives forgot-password email with Spanish subject", async () => {
    const email = "es-reset@example.com";
    const accessToken = await registerVerifyLoginWithLang(email, "es_reset_12", "es");

    // Confirm the stored lang is 'es' before the forgot-password flow
    const meRes = await request(app.getHttpServer())
      .get(`${USERS}/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.lang).toBe("es");

    // Clear outbox so latestOutboxMessage picks up the reset mail only
    const { clearOutbox } = await import("./setup");
    clearOutbox();

    await request(app.getHttpServer())
      .post(`${AUTH}/password/forgot`)
      .send({ email })
      .expect(200);

    const msg = latestOutboxMessage();
    // Spanish subject for reset-password template
    expect(msg.subject).toContain("Restablecer");
    expect(msg.subject).toContain("YanChess");
    // Spanish CTA in the html body
    expect(msg.html).toContain("Restablecer contraseña");
  });

  // @regression — negative: user with no stored lang receives English reset email
  it("user with lang=null receives forgot-password email with English subject", async () => {
    const email = "en-reset@example.com";
    await registerVerifyLoginWithLang(email, "en_reset_12");

    const { clearOutbox } = await import("./setup");
    clearOutbox();

    await request(app.getHttpServer())
      .post(`${AUTH}/password/forgot`)
      .send({ email })
      .expect(200);

    const msg = latestOutboxMessage();
    expect(msg.subject).toContain("Reset your YanChess password");
  });

  // @regression — negative: user with lang='ru' does NOT receive Spanish reset email
  it("user with lang='ru' receives Russian reset email, not Spanish", async () => {
    const email = "ru-reset@example.com";
    await registerVerifyLoginWithLang(email, "ru_reset_12", "ru");

    const { clearOutbox } = await import("./setup");
    clearOutbox();

    await request(app.getHttpServer())
      .post(`${AUTH}/password/forgot`)
      .send({ email })
      .expect(200);

    const msg = latestOutboxMessage();
    // Russian subject
    expect(msg.subject).toContain("Сброс пароля");
    // No Spanish subject
    expect(msg.subject).not.toContain("Restablecer");
  });
});
