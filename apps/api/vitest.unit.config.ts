// @layer: unit
// @spec: 004-matchmaking-and-online-game
import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    pool: "forks",
    testTimeout: 10000,
    include: ["test/unit/**/*.spec.ts"],
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
