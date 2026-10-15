// @layer: integration
// @spec: 009-dev-db-isolation
// Runs before every e2e test file (vitest setupFiles).
// Overrides DATABASE_URL and REDIS_URL so the e2e suite
// targets isolated resources (yanchess_test / Redis DB 1)
// instead of the developer's live databases.
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL_TEST"] ??
  "postgresql://yanchess:yanchess@localhost:5432/yanchess_test?schema=public";
process.env["REDIS_URL"] =
  process.env["REDIS_URL_TEST"] ??
  "redis://localhost:6379/1";
