// @layer: integration
// @spec: 001-registration-and-login
import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  test: {
    setupFiles: ["./test/e2e/env-setup.ts"],
    environment: "node",
    // Run files sequentially to avoid DB deadlocks (all specs share the same Postgres instance).
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  plugins: [
    swc.vite({
      swcrc: false,
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: "es2022",
      },
    }),
  ],
});
