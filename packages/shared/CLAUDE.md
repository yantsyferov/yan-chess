# @yanchess/shared — Shared Package Context

Pure TypeScript types + Zod schemas consumed by both `apps/api` and `apps/web`. See repo root `CLAUDE.md` for project-wide conventions.

---

## What belongs here

- **DTO interfaces** that describe HTTP request/response bodies and socket payloads.
- **Zod schemas** for request validation (reused on both sides — API validates incoming, web validates outgoing).
- **Enum-like `as const` tuples** + their derived union types (e.g. `FriendshipRelationship`, `GameEndReason`).
- **Nothing runtime-heavy.** No business logic, no DB clients, no React. The only runtime dep is `zod`.

Current type modules (`src/types/`): `user`, `game`, `history`, `friends`. Grep `src/index.ts` for the current re-export list.

---

## File convention

- One file per domain under `src/types/<domain>.ts`.
- `src/index.ts` re-exports every module.
- Zod schemas live in `src/schemas/` with same per-domain split.
- Use `interface` for object shapes, `type` only for union / mapped / conditional types.
- Relative imports use the `.js` extension (ESM resolution requirement).

---

## Build + dev loop

- **Build (one-shot):** `pnpm --filter @yanchess/shared build` → `tsc -p tsconfig.build.json` → `dist/` with declaration files.
- **Watch (dev):** `pnpm --filter @yanchess/shared dev` → `tsc --watch --preserveWatchOutput` keeps `dist/` in sync with `src/` (spec 010).
- **Called automatically** by `pnpm dev` from repo root AND by `pnpm --filter api dev` / `pnpm --filter web dev` via `concurrently` (spec 010). You should never need to manually rebuild.
- `package.json` fields:
  - `"main": "dist/index.js"` — Node (API) imports compiled JS.
  - `"module": "src/index.ts"` — Vite (web) imports TS source directly, no dist dependency in dev.
  - `"types": "src/index.ts"` — TypeScript language server reads source for best DX.

---

## Adding a new type

1. Pick or create `src/types/<domain>.ts`.
2. Define interfaces + enum tuples. If the type crosses a Zod validator, add the schema in `src/schemas/<domain>.ts`.
3. Re-export from `src/index.ts`.
4. If `pnpm dev` is running, dist refreshes automatically within ~2s. Consumer apps hot-reload.
5. If adding before Prisma generate (API), restart `pnpm --filter api dev` so the Prisma Client picks up any `@yanchess/shared` enum used in schema.

---

## When editing types

- **Breaking changes are OK during a spec implementation.** Both consumers rebuild in the same workspace, so any mismatch is caught by `pnpm typecheck` at the root.
- **Don't version this package.** It's `private: true` with `version: 0.0.0` — only ever consumed via workspace linkage.
- **Don't add runtime dependencies** besides zod. Keep the compiled dist tiny (~2KB today).
