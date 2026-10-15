// @layer: integration
// @spec: 009-dev-db-isolation
// @regression
//
// Isolation canary — authoritative regression test that the e2e suite NEVER
// touches the developer's live `yanchess` database.
//
// Strategy:
//   1. Open a second PrismaClient pointed directly at `yanchess` (dev DB).
//   2. Insert a canary user into the DEV database.
//   3. The regular e2e harness (env-setup.ts + resetAll) truncates `users`
//      on `yanchess_TEST` — not on dev.
//   4. After the test body runs, assert the canary is still present in dev DB.
//   5. Clean up the canary in afterAll.

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { bootTestApp, resetAll } from "./setup";

// Hard-coded dev DB URL — intentionally does NOT use process.env.DATABASE_URL,
// which env-setup.ts has already overridden to yanchess_test.
const DEV_DB_URL =
  "postgresql://yanchess:yanchess@localhost:5432/yanchess?schema=public";

let app: INestApplication;
let devPrisma: PrismaClient;
let canaryId: string;
const canaryEmail = `canary-isolation-${Date.now()}@test.local`;

beforeAll(async () => {
  // Boot the NestJS test app (targets yanchess_test via env-setup.ts).
  app = await bootTestApp();

  // Open a separate connection to the dev DB.
  devPrisma = new PrismaClient({ datasources: { db: { url: DEV_DB_URL } } });

  // Insert the canary user into the DEV database.
  const canary = await devPrisma.user.create({
    data: {
      email: canaryEmail,
      nickname: "canary_isolation",
      nicknameNormalized: `canary_isolation_${Date.now()}`,
      passwordHash: "$argon2id$canary_placeholder_hash",
      emailVerifiedAt: new Date(),
      passwordUpdatedAt: new Date(),
    },
    select: { id: true },
  });
  canaryId = canary.id;
});

afterAll(async () => {
  // Remove the canary from dev DB to leave it clean.
  try {
    await devPrisma.user.delete({ where: { id: canaryId } });
  } catch {
    // If already deleted (test failure scenario), ignore.
  }
  await devPrisma.$disconnect();
  await app.close();
});

// Reset the TEST DB before each test — this is the operation that would
// accidentally truncate the dev DB if env-setup.ts were missing.
beforeEach(async () => {
  await resetAll(app);
});

describe("[@spec:009-dev-db-isolation][@regression] §2.1 DB isolation — dev DB survives e2e run", () => {
  it("@regression dev DB canary user survives e2e resetAll (yanchess_test truncated, yanchess untouched)", async () => {
    // resetAll was called in beforeEach above.
    // Now verify the canary in the DEV DB is still present.
    const found = await devPrisma.user.findUnique({ where: { id: canaryId } });

    expect(
      found,
      `Canary user ${canaryEmail} was deleted from the dev DB — the e2e harness is targeting the wrong database!`,
    ).not.toBeNull();

    expect(found!.email).toBe(canaryEmail);
  });

  it("yanchess_test users table is empty after resetAll (test DB IS being cleared)", async () => {
    // This confirms the other side: resetAll DID clear the test DB.
    // The app's PrismaClient is connected to yanchess_test (via env-setup.ts).
    // We verify the test DB was truncated by attempting to find the canary email
    // via the app's own Prisma connection — it should not be there (different DB).
    //
    // We make a simple HTTP call that lists users or triggers auth — instead we
    // just query via a second PrismaClient connected to yanchess_test.
    const testDbUrl = process.env["DATABASE_URL"]!;
    expect(testDbUrl).toContain("yanchess_test"); // sanity: we're on test DB

    const testPrisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    try {
      const count = await testPrisma.user.count();
      expect(count).toBe(0); // should be empty after resetAll
    } finally {
      await testPrisma.$disconnect();
    }
  });
});
