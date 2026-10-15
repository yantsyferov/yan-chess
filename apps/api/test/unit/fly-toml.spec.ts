// @layer: unit
// @spec: 011-production-deployment
// @regression
//
// Schema-validation tests for fly.api.toml and fly.web.toml.
// Catches accidental deletion of critical fields during day-to-day development.
//
// Parsing strategy: Python 3 ships tomllib (stdlib since 3.11).  We invoke
//   python3 -c "import tomllib, sys, json; print(json.dumps(tomllib.loads(sys.stdin.read())))"
// to parse the file and return JSON that Node can consume.  No new npm dependency needed.
//
// If Python ≥ 3.11 is unavailable the tests are skipped with an explanatory note.

import { describe, it, expect } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dirname, "../../../..");

function pythonAvailable(): boolean {
  try {
    const result = spawnSync("python3", ["-c", "import tomllib"], { encoding: "utf8" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function parseTOML(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf8");
  const json = execSync(
    "python3 -c \"import tomllib, sys, json; print(json.dumps(tomllib.loads(sys.stdin.read())))\"",
    { input: raw, encoding: "utf8" },
  );
  return JSON.parse(json) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// fly.api.toml
// ---------------------------------------------------------------------------

describe("fly.api.toml — required fields", () => {
  const skip = !pythonAvailable();
  const skipNote = "python3 with tomllib (Python ≥ 3.11) not available — skipping TOML parse tests";

  it.skipIf(skip)(skipNote + " [app]", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.api.toml"));
    expect(toml).toHaveProperty("app");
    expect(typeof toml["app"]).toBe("string");
    expect((toml["app"] as string).length).toBeGreaterThan(0);
  });

  it.skipIf(skip)("primary_region is set", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.api.toml"));
    expect(toml).toHaveProperty("primary_region");
  });

  it.skipIf(skip)("build.dockerfile points to apps/api/Dockerfile", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.api.toml"));
    expect(toml).toHaveProperty("build");
    const build = toml["build"] as Record<string, unknown>;
    expect(build["dockerfile"]).toBe("apps/api/Dockerfile");
  });

  it.skipIf(skip)("http_service section is present", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.api.toml"));
    expect(toml).toHaveProperty("http_service");
  });

  it.skipIf(skip)("[deploy] section is present (even if release_command is commented out)", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.api.toml"));
    expect(toml).toHaveProperty("deploy");
  });

  it.skipIf(skip)("[[vm]] has memory field", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.api.toml"));
    expect(toml).toHaveProperty("vm");
    const vms = toml["vm"] as Record<string, unknown>[];
    expect(vms.length).toBeGreaterThan(0);
    expect(vms[0]).toHaveProperty("memory");
  });
});

// ---------------------------------------------------------------------------
// fly.web.toml
// ---------------------------------------------------------------------------

describe("fly.web.toml — required fields", () => {
  const skip = !pythonAvailable();
  const skipNote = "python3 with tomllib (Python ≥ 3.11) not available — skipping TOML parse tests";

  it.skipIf(skip)(skipNote + " [app]", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.web.toml"));
    expect(toml).toHaveProperty("app");
    expect(typeof toml["app"]).toBe("string");
    expect((toml["app"] as string).length).toBeGreaterThan(0);
  });

  it.skipIf(skip)("primary_region is set", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.web.toml"));
    expect(toml).toHaveProperty("primary_region");
  });

  it.skipIf(skip)("build.dockerfile points to apps/web/Dockerfile", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.web.toml"));
    expect(toml).toHaveProperty("build");
    const build = toml["build"] as Record<string, unknown>;
    expect(build["dockerfile"]).toBe("apps/web/Dockerfile");
  });

  it.skipIf(skip)("build.args.VITE_API_URL is set", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.web.toml"));
    const build = toml["build"] as Record<string, unknown>;
    const args = build["args"] as Record<string, unknown>;
    expect(args).toHaveProperty("VITE_API_URL");
    expect(typeof args["VITE_API_URL"]).toBe("string");
  });

  it.skipIf(skip)("http_service section is present", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.web.toml"));
    expect(toml).toHaveProperty("http_service");
  });

  it.skipIf(skip)("[[vm]] has memory field", () => {
    // @regression
    const toml = parseTOML(join(REPO_ROOT, "fly.web.toml"));
    expect(toml).toHaveProperty("vm");
    const vms = toml["vm"] as Record<string, unknown>[];
    expect(vms.length).toBeGreaterThan(0);
    expect(vms[0]).toHaveProperty("memory");
  });
});

// ---------------------------------------------------------------------------
// Dockerfile smoke — skipped intentionally
// ---------------------------------------------------------------------------

describe("Dockerfile smoke", () => {
  it.skip(
    "SKIP: Full Docker build is 5+ minutes and flaky in CI. " +
    "Slice 1 Verify (spec 011) exercised both Dockerfiles live against production. " +
    "Re-enable only in a dedicated container-build CI job.",
    () => { /* intentional no-op */ },
  );
});
