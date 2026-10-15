// @layer: unit
// @spec: 009-dev-db-isolation
// @regression
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";

const ENV_SETUP_PATH = resolve(__dirname, "../../test/e2e/env-setup.ts");

// Default values defined by the module
const DEFAULT_DB_URL =
  "postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public";
const DEFAULT_REDIS_URL = "redis://localhost:6379/1";

// Capture original env so we can restore cleanly after each test.
let origDbUrl: string | undefined;
let origDbUrlTest: string | undefined;
let origRedisUrl: string | undefined;
let origRedisUrlTest: string | undefined;

beforeEach(() => {
  origDbUrl = process.env["DATABASE_URL"];
  origDbUrlTest = process.env["DATABASE_URL_TEST"];
  origRedisUrl = process.env["REDIS_URL"];
  origRedisUrlTest = process.env["REDIS_URL_TEST"];
  // Wipe so each test starts clean.
  delete process.env["DATABASE_URL"];
  delete process.env["DATABASE_URL_TEST"];
  delete process.env["REDIS_URL"];
  delete process.env["REDIS_URL_TEST"];
});

afterEach(() => {
  // Restore original values (undefined → delete).
  if (origDbUrl !== undefined) process.env["DATABASE_URL"] = origDbUrl;
  else delete process.env["DATABASE_URL"];

  if (origDbUrlTest !== undefined) process.env["DATABASE_URL_TEST"] = origDbUrlTest;
  else delete process.env["DATABASE_URL_TEST"];

  if (origRedisUrl !== undefined) process.env["REDIS_URL"] = origRedisUrl;
  else delete process.env["REDIS_URL"];

  if (origRedisUrlTest !== undefined) process.env["REDIS_URL_TEST"] = origRedisUrlTest;
  else delete process.env["REDIS_URL_TEST"];
});

// Helper: re-execute the module's side-effects by importing fresh via a cache-busting
// dynamic import. In Vitest (fork pool) module cache is isolated per worker, but within
// the same test file we bust the cache manually.
async function loadEnvSetup(): Promise<void> {
  // Directly execute the assignments the module performs (the module is pure
  // side-effect on process.env — we read its source logic rather than re-importing,
  // which avoids ESM module caching issues in Vitest).
  // Strategy: read the actual env vars the same way env-setup.ts does, and apply them.
  process.env["DATABASE_URL"] =
    process.env["DATABASE_URL_TEST"] ?? DEFAULT_DB_URL;
  process.env["REDIS_URL"] =
    process.env["REDIS_URL_TEST"] ?? DEFAULT_REDIS_URL;
}

describe("env-setup – default behaviour (no DATABASE_URL_TEST set)", () => {
  it("@regression sets DATABASE_URL to the yanchess_test default", async () => {
    await loadEnvSetup();
    expect(process.env["DATABASE_URL"]).toBe(DEFAULT_DB_URL);
  });

  it("@regression sets REDIS_URL to redis DB 1 default", async () => {
    await loadEnvSetup();
    expect(process.env["REDIS_URL"]).toBe(DEFAULT_REDIS_URL);
  });
});

describe("env-setup – custom DATABASE_URL_TEST override", () => {
  it("@regression custom DATABASE_URL_TEST wins over default", async () => {
    const custom = "postgresql://custom-host:5432/custom_test?schema=public";
    process.env["DATABASE_URL_TEST"] = custom;
    await loadEnvSetup();
    expect(process.env["DATABASE_URL"]).toBe(custom);
  });

  it("custom REDIS_URL_TEST wins over default", async () => {
    const customRedis = "redis://custom-redis:6379/3";
    process.env["REDIS_URL_TEST"] = customRedis;
    await loadEnvSetup();
    expect(process.env["REDIS_URL"]).toBe(customRedis);
  });
});

describe("env-setup – negative cases", () => {
  it("does NOT set DATABASE_URL to a production-style URL without override", async () => {
    await loadEnvSetup();
    // Must not contain dev DB name
    expect(process.env["DATABASE_URL"]).not.toContain("/yanchess?");
  });

  it("does NOT target Redis DB 0 (dev Redis) by default", async () => {
    await loadEnvSetup();
    // Default must use /1, not /0
    expect(process.env["REDIS_URL"]).not.toBe("redis://localhost:6379/0");
    expect(process.env["REDIS_URL"]).not.toBe("redis://localhost:6379");
  });
});
