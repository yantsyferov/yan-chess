# YanChess Web — Frontend Context

React 18 + TypeScript + Vite + Tailwind v4 + Zustand + react-chessboard + socket.io-client. See repo root `CLAUDE.md` for project-wide conventions.

---

## Feature folder convention

Every domain lives under `src/features/<domain>/`. Typical files:

| File                       | Role                                                   |
| -------------------------- | ------------------------------------------------------ |
| `<Component>.tsx`          | React component (page block, card, dialog, etc.)       |
| `use<Domain>Store.ts`      | Zustand store — state + actions + socket listeners     |
| `socket.ts` or `<domain>-socket.ts` | Socket.io-client singleton for this namespace |
| `useChallenge.ts` / tiny hook files | Shared tick/polling/derivation hooks         |

Pages (`src/pages/`) are thin — they read URL state, mount feature components, call `store.wire()` on mount. Business logic lives in stores.

Current domains: `auth`, `online` (matchmaking + online game), `vs-bot`, `game` (hotseat), `history`, `friends`, `theme`.

---

## Zustand store conventions

**`wire()` is idempotent.** Called from pages/layout mount. Guards against double-wiring via a module-level `_wired` boolean:

```ts
let _wired = false;
export const useFooStore = create<FooState>((set, get) => ({
  // state + actions
  wire: async () => {
    if (_wired) return;
    _wired = true;
    // 1. REST snapshot fetches
    // 2. getFooSocket() + sock.on(...) listeners
  },
}));
```

**Socket singletons** live in `features/<domain>/<name>-socket.ts`. Pattern: `let socket; let builtWithToken; getFooSocket() { if (socket && builtWithToken === currentToken) return socket; disconnect old; io(...) new; }`. Token-change rebuild handles login/logout.

**Reset on logout:** stores expose a `reset()` helper that `_wired = false` and clears state. `authService.logout()` calls each `reset()` + socket disconnect.

See `features/online/useOnlineGameStore.ts` + `features/friends/useFriendsStore.ts` for the canonical examples.

---

## Routes

`src/routes.tsx`:

- **Public routes:** `/login`, `/register`, `/verify-email`, `/verify-email/check`, `/forgot-password`, `/reset-password`, `/game` (hotseat), `*` (404 → home).
- **Authenticated routes** (under `<ProtectedRoute><AuthenticatedLayout>`): `/`, `/profile`, `/play`, `/vs-bot`, `/history`, `/history/:gameId`, `/friends`.

**`AuthenticatedLayout`** (spec 007 Slice 7, spec 010):
- Mounts once per auth session.
- Calls `useFriendsStore.wire()` + `wireOnlineGameSocket()` on mount — socket connections stay live on every protected page.
- Renders `<FriendsNotificationLayer />` (React Portal) — challenge toasts + friend-request toasts appear on every protected page.
- Subscribes to `useOnlineGameStore.gameId + pendingNavigate` → navigates to `/play` ONLY when BOTH are set (opt-in guard, spec 010).

---

## Navigation opt-in (spec 010 §2.2)

Any user action that intentionally starts an online game must set `useOnlineGameStore.pendingNavigate = true` so `AuthenticatedLayout` auto-routes to `/play` when `gameId` arrives.

**SET** sites:
- `useMatchmakingStore.joinQueue()` — "Find Game" click.
- `useFriendsStore.sendChallenge()` — challenger side.
- `useFriendsStore.respondInboundChallenge(true)` — target accepts.

**CLEAR** sites:
- `useMatchmakingStore.leaveQueue()` — queue cancelled.
- `useFriendsStore.cancelOutboundChallenge()`.
- Socket listeners for `challenge.declined` / `challenge.expired` / `challenge.cancelled`.
- `AuthenticatedLayout` effect after `navigate("/play")` fires (consume).

**Known limitation (spec 010 AC §2.2 #6 deferred):** opt-in doesn't persist across page navigation. Navigating away from `/play` while in matchmaking triggers `Play.tsx` unmount cleanup, which calls `leaveQueue()` → clears both server-side queue entry AND `pendingNavigate`. Fixing this needs a separate product decision + lifecycle refactor.

---

## HTTP + sockets

**HTTP client:** `src/features/auth/apiClient.ts` exports `apiGet`, `apiPost`, `apiDelete`, `authedFetch`. All read `VITE_API_URL` (baked at build time) + attach `Authorization: Bearer <accessToken>` from `useAuthStore`. On 401 → auto-refresh via `/auth/refresh` → retry original request. Returns null on refresh failure so `ProtectedRoute` can redirect cleanly.

**Sockets:** two namespaces — `/play` (matchmaking + games) and `/friends` (challenges + presence + friend requests). Singletons:
- `src/features/online/socket.ts` → `getSocket()` / `disconnectSocket()` / `resetSocket()`
- `src/features/friends/friends-socket.ts` → same shape, namespace `friends`

Both are structurally identical (~60 lines) — one-day-of-work refactor opportunity to extract `createNamespaceSocket(ns)`. Not critical.

---

## Shared types

Import from `@yanchess/shared` — pnpm workspace link to `packages/shared/`.

In dev, `pnpm dev` runs a `tsc --watch` on shared so compiled dist stays in sync with src (spec 010). If you add a type and get "undefined is not a function" at runtime far from the edit site, the watcher may have been killed — restart `pnpm dev`.

Prod: Vite respects shared's `"module": "src/index.ts"` field and bundles the TS source directly.

---

## Testing

- Vitest + Testing Library + jsdom.
- `pnpm --filter web test -- --run` for CI-style single run.
- 278 tests currently. Test files live next to the code (`src/features/.../*.spec.ts` + `src/features/.../__tests__/*.test.ts`).
- **No Playwright in this project.** Playwright MCP is used only during `/awos:verify` by the `general-purpose` agent — not part of `pnpm test`.
- Store tests use real Zustand stores (not mocked) to catch wiring errors. See `features/online/__tests__/useOnlineGameStore.pendingNavigate.test.ts` for the canonical shape.
- Mock socket.io-client via `vi.mock('socket.io-client', ...)` at the top of socket-touching tests.

---

## Dev loop

- **Preferred:** `pnpm dev` from repo root — concurrently starts shared watcher + api + web (spec 010).
- **Web only:** `pnpm --filter web dev` — concurrently starts shared watcher + `vite`. Vite dev server on port 5173.
- **Build (prod-style):** `pnpm --filter web build` → `apps/web/dist/`. Served by Caddy in the Docker image.

**Vite env vars** must be prefixed `VITE_` to reach the client. `VITE_API_URL` is the only one we use — baked at build time via Dockerfile ARG + `fly.web.toml → [build.args]`. Changing it requires a rebuild.

---

## Styling

- **Tailwind v4** with CSS-variable tokens in `src/styles/tokens.css` (`@theme` block + `:root[data-theme="dark|light"]`).
- **Theming:** `data-theme` attribute on `<html>` controlled by `useThemeStore` (persisted in localStorage, fallback to `prefers-color-scheme`). FOUC prevented by sync inline script in `index.html` before React mounts.
- **UI primitives** in `src/components/ui/`: `Button`, `Input`, `Card`, `Alert`, `Dialog` (Radix), `DropdownMenu` (Radix), `Avatar`, `Header`. In-house unless noted.
- **Icons:** `lucide-react`, tree-shaken single-weight SVG.
- **Typography:** Inter Variable via `@fontsource-variable/inter`, self-hosted.

---

## Deployment

Prod: `fly deploy -c fly.web.toml --app yanchess` from repo root. Caddy image serves `dist/` with SPA fallback (`try_files {path} /index.html`) + gzip.

Image is tiny (~25MB compressed). Build context is repo root. `fly.web.toml` lives at repo root.
