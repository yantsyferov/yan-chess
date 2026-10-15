// @layer: integration
// @spec: 012-i18n
import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bootTestApp, resetAll, OUTBOX } from "./setup";

let app: INestApplication;

beforeAll(async () => { app = await bootTestApp(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => { await resetAll(app); });

const BASE = "/api/v1/auth";

function latestOutboxMessage(): { subject: string; html: string; lang?: string } {
  const files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error("No outbox files found");
  const latest = files[files.length - 1]!;
  return JSON.parse(readFileSync(join(OUTBOX, latest), "utf8")) as {
    subject: string;
    html: string;
    lang?: string;
  };
}

describe("[@spec:012-i18n] register with lang=ru sends Russian email", () => {
  it("subject contains YanChess and Russian key phrase; html contains Russian button", async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({
        email: "ru-user@example.com",
        nickname: "ru_user_42",
        password: "Secret123",
        confirmPassword: "Secret123",
        lang: "ru",
      })
      .expect(201);

    const msg = latestOutboxMessage();
    expect(msg.subject).toContain("YanChess");
    expect(msg.subject).toContain("Подтвердите");
    expect(msg.html).toContain("Подтвердить");
  });
});

describe("[@spec:012-i18n] register with lang=es sends Spanish email", () => {
  it("subject contains YanChess and Spanish key phrase; html contains Spanish button", async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/register`)
      .send({
        email: "es-user@example.com",
        nickname: "es_user_42",
        password: "Secret123",
        confirmPassword: "Secret123",
        lang: "es",
      })
      .expect(201);

    const msg = latestOutboxMessage();
    expect(msg.subject).toContain("YanChess");
    expect(msg.subject).toContain("Verifica");
    expect(msg.html).toContain("Verificar");
  });
});
