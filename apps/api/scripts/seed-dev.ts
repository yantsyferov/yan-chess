/**
 * seed-dev.ts — populate dev DB with known fixtures for local development.
 *
 * Users: alice, bob, charlie  (password: Password123!, email verified)
 * Ratings: Blitz 1500 for each (CREATE only; preserves real-game ratings on update)
 * Friendship: alice ↔ bob, accepted
 *
 * Usage:  pnpm --filter api seed:dev
 * Safety: refuses to run against a *_test DB (pass --allow-test-db to override)
 */

import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

// Match auth stack params exactly (auth.service.ts ARGON2_OPTIONS)
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const SEED_PASSWORD = "Password123!";

interface UserConfig {
  email: string;
  nickname: string;
}

const USERS: readonly UserConfig[] = [
  { email: "alice@test.local", nickname: "alice" },
  { email: "bob@test.local", nickname: "bob" },
  { email: "charlie@test.local", nickname: "charlie" },
] as const;

export async function main(): Promise<void> {
  // Safety-net: refuse to run against a test DB without explicit override
  if (
    process.env["DATABASE_URL"]?.includes("_test") &&
    !process.argv.includes("--allow-test-db")
  ) {
    console.error(
      "[seed-dev] DATABASE_URL points at a test DB; pass --allow-test-db if you really mean it",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const startMs = Date.now();

  try {
    const hash = await argon2.hash(SEED_PASSWORD, ARGON2_OPTIONS);

    const seededUsers: Record<string, { id: string; nickname: string }> = {};

    for (const { email, nickname } of USERS) {
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          nickname,
          nicknameNormalized: nickname.toLowerCase(),
          passwordHash: hash,
          emailVerifiedAt: new Date(),
          passwordUpdatedAt: new Date(),
        },
        update: {
          passwordHash: hash,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, nickname: true },
      });

      seededUsers[nickname] = user;
    }

    // Upsert Blitz 1500 rating for each user (CREATE only; UPDATE is empty to preserve real ratings)
    for (const { id } of Object.values(seededUsers)) {
      await prisma.ratingByMode.upsert({
        where: { userId_mode: { userId: id, mode: "Blitz" } },
        create: {
          userId: id,
          mode: "Blitz",
          rating: 1500,
          rd: 350,
          volatility: 0.06,
          gamesPlayed: 0,
        },
        update: {},
      });
    }

    // Canonical alice ↔ bob friendship (lexicographic UUID ordering)
    const alice = seededUsers["alice"];
    const bob = seededUsers["bob"];

    if (!alice || !bob) {
      throw new Error("alice or bob not found in seeded users");
    }

    const [userAId, userBId] =
      alice.id < bob.id ? [alice.id, bob.id] : [bob.id, alice.id];

    await prisma.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: {
        userAId,
        userBId,
        status: "accepted",
        initiatedBy: alice.id,
        respondedAt: new Date(),
      },
      update: {
        status: "accepted",
        respondedAt: new Date(),
      },
    });

    const elapsedMs = Date.now() - startMs;
    console.log(
      `[seed-dev] alice, bob, charlie seeded + alice↔bob friendship accepted (took ${elapsedMs}ms)`,
    );

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`[seed-dev] FAILED: ${message}`);
    if (stack) console.error(stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Only auto-run when executed directly (not when imported by tests).
if (process.argv[1] === import.meta.filename) main();
