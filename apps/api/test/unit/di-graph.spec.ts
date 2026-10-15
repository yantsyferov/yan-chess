// @layer: unit
// @spec: 008-backend-dx
// @regression
import "reflect-metadata";
import { execSync } from "child_process";
import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import { Module } from "@nestjs/common";
import { RealtimeEmitter } from "../../src/modules/realtime/realtime-emitter";
import { PresenceService } from "../../src/modules/realtime/presence.service";

// ---------------------------------------------------------------------------
// Minimal Prisma stub provider — avoids real DB connection
// ---------------------------------------------------------------------------

const PrismaServiceToken = "PrismaService";

const prismaStubProvider = {
  provide: PrismaServiceToken,
  useValue: {
    friendship: { findMany: () => Promise.resolve([]) },
  },
};

// Import real providers but override PrismaService token to avoid DB
// We build a thin wrapper module that supplies the stub
@Module({
  providers: [
    prismaStubProvider,
    {
      provide: "PrismaService",
      useValue: {
        friendship: { findMany: () => Promise.resolve([]) },
      },
    },
    RealtimeEmitter,
    {
      provide: PresenceService,
      useFactory: (realtime: RealtimeEmitter) => {
        // Minimal PresenceService with a stub prisma — avoids real DB
        return new PresenceService(
          { friendship: { findMany: () => Promise.resolve([]) } } as any,
          realtime,
        );
      },
      inject: [RealtimeEmitter],
    },
  ],
  exports: [RealtimeEmitter, PresenceService],
})
class TestRealtimeModule {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DI graph — module wiring invariants", () => {
  // -------------------------------------------------------------------------
  // 1. Static regression: no forwardRef anywhere in the module cluster
  // -------------------------------------------------------------------------

  it(
    "@regression no forwardRef in friends/ or game/ modules",
    () => {
      let output = "";
      try {
        output = execSync(
          "grep -rn 'forwardRef' apps/api/src/modules/friends/ apps/api/src/modules/game/",
          {
            cwd: "/Users/yantsyferov/Desktop/YanChess",
            encoding: "utf-8",
          },
        );
      } catch (e: any) {
        // grep exits with code 1 when no matches found — that is the success case
        if (e.status === 1) {
          output = e.stdout ?? "";
        } else {
          throw e;
        }
      }
      const lines = output
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      expect(lines.length).toBe(0);
    },
  );

  // -------------------------------------------------------------------------
  // 2. No forwardRef in matchmaking or realtime modules either
  // -------------------------------------------------------------------------

  it(
    "@regression no forwardRef in matchmaking/ or realtime/ modules",
    () => {
      let output = "";
      try {
        output = execSync(
          "grep -rn 'forwardRef' apps/api/src/modules/matchmaking/ apps/api/src/modules/realtime/",
          {
            cwd: "/Users/yantsyferov/Desktop/YanChess",
            encoding: "utf-8",
          },
        );
      } catch (e: any) {
        if (e.status === 1) {
          output = e.stdout ?? "";
        } else {
          throw e;
        }
      }
      const lines = output
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      expect(lines.length).toBe(0);
    },
  );

  // -------------------------------------------------------------------------
  // 3. RealtimeEmitter and PresenceService are resolvable from the DI container
  // -------------------------------------------------------------------------

  it("RealtimeEmitter resolves from DI container without error", async () => {
    const module = await Test.createTestingModule({
      imports: [TestRealtimeModule],
    }).compile();

    const emitter = module.get(RealtimeEmitter);
    expect(emitter).toBeInstanceOf(RealtimeEmitter);
    await module.close();
  });

  it("PresenceService resolves from DI container without error", async () => {
    const module = await Test.createTestingModule({
      imports: [TestRealtimeModule],
    }).compile();

    const presence = module.get(PresenceService);
    expect(presence).toBeInstanceOf(PresenceService);
    await module.close();
  });

  // -------------------------------------------------------------------------
  // 4. Negative: unregistered token throws (DI contract)
  // -------------------------------------------------------------------------

  it("DI container throws when requesting an unregistered token", async () => {
    const module = await Test.createTestingModule({
      imports: [TestRealtimeModule],
    }).compile();

    expect(() => module.get("NonExistentService")).toThrow();
    await module.close();
  });
});
