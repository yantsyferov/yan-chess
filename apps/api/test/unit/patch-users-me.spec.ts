// @layer: unit
// @spec: 012-i18n
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateMeSchema } from "@yanchess/shared";
import { UsersService } from "../../src/modules/users/users.service";
import { Mode } from "@prisma/client";

// ---------------------------------------------------------------------------
// Prisma stub
// ---------------------------------------------------------------------------
function makePrismaStub() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

type PrismaStub = ReturnType<typeof makePrismaStub>;

function makeUserRow(overrides: Partial<{ lang: string | null }> = {}) {
  return {
    id: "user-1",
    nickname: "alice",
    email: "alice@example.com",
    createdAt: new Date("2024-01-01"),
    lang: overrides.lang ?? null,
    ratings: [
      { mode: Mode.Bullet, rating: 1500, gamesPlayed: 0 },
      { mode: Mode.Blitz, rating: 1500, gamesPlayed: 0 },
      { mode: Mode.Rapid, rating: 1500, gamesPlayed: 0 },
      { mode: Mode.Classical, rating: 1500, gamesPlayed: 0 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------
describe("UpdateMeSchema", () => {
  it("rejects an invalid lang value (fr)", () => {
    const result = updateMeSchema.safeParse({ lang: "fr" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid lang value (es)", () => {
    const result = updateMeSchema.safeParse({ lang: "es" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lang).toBe("es");
  });

  it("accepts an empty object (lang is optional)", () => {
    const result = updateMeSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lang).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// UsersService.updateMe unit tests
// ---------------------------------------------------------------------------
describe("UsersService.updateMe", () => {
  let prisma: PrismaStub;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrismaStub();
    service = new UsersService(prisma as never);
  });

  it("calls prisma.user.update with lang when provided", async () => {
    prisma.user.update.mockResolvedValue(makeUserRow({ lang: "ru" }));

    const result = await service.updateMe("user-1", { lang: "ru" });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { lang: "ru" },
      }),
    );
    expect(result.lang).toBe("ru");
  });

  it("calls prisma.user.update with undefined lang when dto.lang is undefined (no-op)", async () => {
    prisma.user.update.mockResolvedValue(makeUserRow({ lang: null }));

    await service.updateMe("user-1", {});

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lang: undefined },
      }),
    );
  });

  it("response includes updated lang", async () => {
    prisma.user.update.mockResolvedValue(makeUserRow({ lang: "es" }));

    const result = await service.updateMe("user-1", { lang: "es" });

    expect(result.lang).toBe("es");
    expect(result.id).toBe("user-1");
    expect(result.email).toBe("alice@example.com");
  });
});
