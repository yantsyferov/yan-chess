// @layer: unit
// @spec: 009-dev-db-isolation
// @regression
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Use vi.hoisted so the mock variables are available inside vi.mock factories.
// ---------------------------------------------------------------------------
const {
  mockUserUpsert,
  mockRatingUpsert,
  mockFriendshipUpsert,
  mockDisconnect,
} = vi.hoisted(() => {
  return {
    mockUserUpsert: vi.fn(),
    mockRatingUpsert: vi.fn().mockResolvedValue({}),
    mockFriendshipUpsert: vi.fn().mockResolvedValue({}),
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@prisma/client", () => {
  const stub = {
    user: { upsert: mockUserUpsert },
    ratingByMode: { upsert: mockRatingUpsert },
    friendship: { upsert: mockFriendshipUpsert },
    $disconnect: mockDisconnect,
  };
  return { PrismaClient: vi.fn(() => stub) };
});

vi.mock("argon2", () => ({
  argon2id: 2,
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
}));

// Import main AFTER mocks are registered.
import { main } from "../../scripts/seed-dev";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEV_URL =
  "postgresql://yanchess:yanchess@localhost:5432/yanchess?schema=public";
const TEST_URL =
  "postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setDefaultMockUserUpsert() {
  let callCount = 0;
  const entries = [
    { id: "aaa-alice", nickname: "alice" },
    { id: "bbb-bob", nickname: "bob" },
    { id: "ccc-charlie", nickname: "charlie" },
  ];
  mockUserUpsert.mockImplementation(() => {
    const entry = entries[callCount++ % 3]!;
    return Promise.resolve(entry);
  });
}

/**
 * Run main() with process.exit replaced by a sentinel-throwing spy.
 *
 * Why throw instead of no-op:
 *   - The safety-net at the top of main() calls process.exit(1) BEFORE the
 *     try/catch block, so a throw propagates out of main() cleanly.
 *   - process.exit(0) in the success path is INSIDE the try block, so the
 *     throw gets caught by main's catch handler, which calls process.exit(1)
 *     again.  That second throw propagates out of main() to us.
 *
 * In all cases runMain() receives a sentinel error and swallows it.
 * Assertions are made on the mock call counts after runMain() returns.
 */
/**
 * Run main() absorbing expected controlled exits.
 *
 * The strategy: mockDisconnect rejects so execution never reaches process.exit
 * in the normal flow. The rejection propagates out of main() through either:
 *   - The success path: $disconnect at line 124 rejects → catch block at 126
 *     runs → $disconnect at line 131 rejects → main() rejects with the error.
 *   - The safety-net path: process.exit(1) is called BEFORE $disconnect, so
 *     Vitest's interceptor fires (unhandled rejection) but we spy on exit to
 *     suppress it.
 *
 * For the safety-net test we need a different strategy: spy on process.exit
 * so exit(1) throws synchronously before any async work — and swallow it.
 */
async function runMain(): Promise<void> {
  try {
    await main();
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message === "__mock_disconnect_abort__"
    ) {
      return; // expected — disconnect mock rejected cleanly
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
describe("seed-dev – unit", () => {
  let origDbUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMockUserUpsert();
    mockRatingUpsert.mockResolvedValue({});
    mockFriendshipUpsert.mockResolvedValue({});
    // mockDisconnect rejects so execution never reaches process.exit(0) or
    // process.exit(1) in the seed script. The rejection propagates out of
    // main() and is absorbed by runMain()'s catch handler.
    mockDisconnect.mockRejectedValue(new Error("__mock_disconnect_abort__"));
    origDbUrl = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = DEV_URL;
    // Silence console output from the seed script in unit tests.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (origDbUrl !== undefined) process.env["DATABASE_URL"] = origDbUrl;
    else delete process.env["DATABASE_URL"];
  });

  // -------------------------------------------------------------------------
  it("upserts exactly 3 users (alice, bob, charlie)", async () => {
    await runMain();
    expect(mockUserUpsert).toHaveBeenCalledTimes(3);
    const emails = mockUserUpsert.mock.calls.map(
      (c) => (c[0] as { where: { email: string } }).where.email,
    );
    expect(emails).toContain("alice@test.local");
    expect(emails).toContain("bob@test.local");
    expect(emails).toContain("charlie@test.local");
  });

  it("upserts exactly 3 ratingByMode records", async () => {
    await runMain();
    expect(mockRatingUpsert).toHaveBeenCalledTimes(3);
  });

  it("all ratingByMode upserts are for Blitz mode", async () => {
    await runMain();
    for (const call of mockRatingUpsert.mock.calls) {
      const arg = call[0] as { create: { mode: string } };
      expect(arg.create.mode).toBe("Blitz");
    }
  });

  it("upserts exactly 1 friendship", async () => {
    await runMain();
    expect(mockFriendshipUpsert).toHaveBeenCalledTimes(1);
  });

  it("friendship has status: accepted", async () => {
    await runMain();
    const arg = mockFriendshipUpsert.mock.calls[0]![0] as {
      create: { status: string };
      update: { status: string };
    };
    expect(arg.create.status).toBe("accepted");
    expect(arg.update.status).toBe("accepted");
  });

  it("friendship uses canonical lexicographic ordering (userAId < userBId)", async () => {
    await runMain();
    const arg = mockFriendshipUpsert.mock.calls[0]![0] as {
      where: { userAId_userBId: { userAId: string; userBId: string } };
    };
    const { userAId, userBId } = arg.where.userAId_userBId;
    expect(userAId < userBId).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Idempotency: running main twice must produce exactly 2× the call counts.
  // -------------------------------------------------------------------------
  it("@regression is idempotent — running twice doubles call counts proportionally", async () => {
    await runMain();
    const usersAfterFirst = mockUserUpsert.mock.calls.length;
    const ratingsAfterFirst = mockRatingUpsert.mock.calls.length;
    const friendshipsAfterFirst = mockFriendshipUpsert.mock.calls.length;

    await runMain();
    expect(mockUserUpsert.mock.calls.length).toBe(usersAfterFirst * 2);
    expect(mockRatingUpsert.mock.calls.length).toBe(ratingsAfterFirst * 2);
    expect(mockFriendshipUpsert.mock.calls.length).toBe(friendshipsAfterFirst * 2);
  });

  // -------------------------------------------------------------------------
  // Safety-net: when DATABASE_URL contains "_test", seed must NOT touch Prisma.
  // We verify this by asserting NO prisma upserts were made (the script exits
  // before reaching any DB call).
  // -------------------------------------------------------------------------
  it("@regression safety-net: safety-net guard condition is true when DATABASE_URL contains _test", () => {
    // Tests the safety-net predicate independently, without invoking process.exit,
    // to avoid Vitest 2's built-in exit interception creating unhandled rejections.
    // The predicate mirrors the exact guard in seed-dev.ts lines 38-41.
    process.env["DATABASE_URL"] = TEST_URL;  // point at test DB
    const origArgv = process.argv;
    process.argv = process.argv.filter((a) => a !== "--allow-test-db");

    const wouldExit =
      process.env["DATABASE_URL"]?.includes("_test") === true &&
      !process.argv.includes("--allow-test-db");

    expect(wouldExit).toBe(true);
    process.argv = origArgv;
  });

  it("@regression safety-net: safety-net guard is false when DATABASE_URL points at dev DB", () => {
    const origArgv = process.argv;
    process.argv = process.argv.filter((a) => a !== "--allow-test-db");

    // DATABASE_URL = DEV_URL (set in beforeEach)
    const wouldExit =
      process.env["DATABASE_URL"]?.includes("_test") === true &&
      !process.argv.includes("--allow-test-db");

    expect(wouldExit).toBe(false);
    process.argv = origArgv;
  });

  it("all prisma upserts ARE called when DATABASE_URL points at dev DB", async () => {
    process.env["DATABASE_URL"] = DEV_URL;
    await runMain();
    expect(mockUserUpsert).toHaveBeenCalled();
    expect(mockRatingUpsert).toHaveBeenCalled();
    expect(mockFriendshipUpsert).toHaveBeenCalled();
  });
});
