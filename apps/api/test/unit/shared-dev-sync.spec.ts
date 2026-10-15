// @layer: unit
// @spec: 010-frontend-reliability
// @regression

/**
 * Smoke test: the @yanchess/shared one-shot build pipeline still works after
 * the Slice-1 dev-script changes.
 *
 * Strategy:
 *   1. Append a canary export to packages/shared/src/types/user.ts.
 *   2. Spawn `pnpm --filter @yanchess/shared build` and assert exit code 0.
 *   3. Read the compiled output and assert it contains the canary identifier.
 *   4. Clean up: revert the source file + rebuild to restore pristine dist.
 *
 * NOTE: Testing the WATCH loop in CI is flaky (timing-dependent). This test
 * verifies one-shot build correctness only — the watch behaviour was verified
 * live during Slice-1 implementation.
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../");
const USER_TS = resolve(REPO_ROOT, "packages/shared/src/types/user.ts");
const USER_JS = resolve(REPO_ROOT, "packages/shared/dist/types/user.js");

const CANARY = "SPEC_010_FTR_CANARY";
const CANARY_LINE = `\nexport const ${CANARY} = 'ok';\n`;

/** Run the shared build. Throws if exit code != 0. */
function buildShared(): void {
  execFileSync("pnpm", ["--filter", "@yanchess/shared", "build"], {
    cwd: REPO_ROOT,
    timeout: 60_000,
    stdio: "pipe",
    // execFileSync throws on non-zero exit by default.
  });
}

// Preserve original source so afterAll can restore even if the test aborts.
const originalUserTs = readFileSync(USER_TS, "utf8");

afterAll(() => {
  // Always revert source — idempotent even if test passed cleanly.
  const current = readFileSync(USER_TS, "utf8");
  if (current.includes(CANARY)) {
    writeFileSync(USER_TS, originalUserTs, "utf8");
    // Rebuild to restore pristine dist.
    try {
      buildShared();
    } catch {
      // Best-effort cleanup — don't mask original test failure.
    }
  }
});

describe("shared package one-shot build (spec 010 regression)", () => {
  // @regression
  it("build succeeds (exit 0) after appending a new export to user.ts", () => {
    // 1. Append canary line.
    writeFileSync(USER_TS, originalUserTs + CANARY_LINE, "utf8");

    // 2. Build — throws if non-zero exit code.
    expect(() => buildShared()).not.toThrow();
  });

  // @regression
  it("compiled dist/types/user.js contains the canary identifier", () => {
    const compiled = readFileSync(USER_JS, "utf8");
    expect(compiled).toContain(CANARY);
  });

  it("negative: build output does NOT contain canary after revert + rebuild", () => {
    // Revert source.
    writeFileSync(USER_TS, originalUserTs, "utf8");
    // Rebuild — canary should be gone.
    buildShared();

    const compiled = readFileSync(USER_JS, "utf8");
    expect(compiled).not.toContain(CANARY);
  });
});
