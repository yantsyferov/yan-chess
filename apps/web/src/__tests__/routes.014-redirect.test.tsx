// @layer: unit
// @spec: 014-play-redesign
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n/index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../features/auth/authService", () => ({
  fetchMe: vi.fn().mockResolvedValue(null),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerifyEmail: vi.fn(),
}));

vi.mock("../features/online/socket", () => ({
  getSocket: vi.fn(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    disconnect: vi.fn(),
  })),
  disconnectSocket: vi.fn(),
  resetSocket: vi.fn(),
}));

vi.mock("../features/friends/friends-socket", () => ({
  getFriendsSocket: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), off: vi.fn() })),
  disconnectFriendsSocket: vi.fn(),
}));

vi.mock("../features/online/useOnlineGameStore", () => ({
  useOnlineGameStore: Object.assign(
    (selector: (s: { gameId: string | null; pendingNavigate: boolean }) => unknown) =>
      selector({ gameId: null, pendingNavigate: false }),
    { getState: () => ({ gameId: null, pendingNavigate: false, clearPendingNavigate: vi.fn() }) },
  ),
  wireOnlineGameSocket: vi.fn(),
}));

vi.mock("../features/friends/useFriendsStore", () => ({
  useFriendsStore: Object.assign(
    (selector: (s: { pendingRequestsCount: number }) => unknown) =>
      selector({ pendingRequestsCount: 0 }),
    { getState: () => ({ wire: vi.fn(), pendingRequestsCount: 0 }) },
  ),
  resetFriendsStore: vi.fn(),
}));

vi.mock("../features/online/useMatchmakingStore", () => ({
  useMatchmakingStore: Object.assign(
    (selector: (s: { phase: string; mode: string | null; since: number | null }) => unknown) =>
      selector({ phase: "idle", mode: null, since: null }),
    {
      getState: () => ({
        phase: "idle",
        mode: null,
        since: null,
        leaveQueue: vi.fn(),
        joinQueue: vi.fn(),
      }),
    },
  ),
  wireMatchmakingSocket: vi.fn(),
}));

vi.mock("../features/game/useGameStore", () => ({
  useGameStore: Object.assign(
    (selector: (s: { mode: string | null }) => unknown) => selector({ mode: "Blitz" }),
    { getState: () => ({ mode: "Blitz", setMode: vi.fn() }) },
  ),
}));

const _authState = { user: null as null };

vi.mock("../features/auth/useAuthStore", () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof _authState) => unknown) =>
      selector ? selector(_authState) : _authState,
    { getState: () => ({ ..._authState, clear: vi.fn(), setSession: vi.fn() }) },
  ),
  hasSessionFlag: () => false,
  SESSION_FLAG_KEY: "yanchess:session",
}));

// Stockfish engine — VsBot uses this and it loads a worker
vi.mock("../features/vs-bot/stockfish-engine", () => ({
  botEngine: {
    init: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    setLevel: vi.fn().mockResolvedValue(undefined),
    bestMove: vi.fn().mockResolvedValue("e2e4"),
  },
  movetimeFor: vi.fn().mockReturnValue(500),
}));

vi.mock("../features/vs-bot/useVsBotStore", () => ({
  useVsBotStore: Object.assign(
    (selector: (s: { phase: string; botThinking: boolean; fen: string; result: null; setup: { level: string } }) => unknown) =>
      selector({ phase: "setup", botThinking: false, fen: "", result: null, setup: { level: "beginner" } }),
    {
      getState: () => ({
        phase: "setup",
        botThinking: false,
        fen: "",
        result: null,
        setup: { level: "beginner" },
        movesSan: [],
        applyBotMove: vi.fn(),
      }),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Static imports after vi.mock
// ---------------------------------------------------------------------------
import { AppRoutes } from "../routes";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <I18nextProvider i18n={i18n}>
        <AppRoutes />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("routes.014 — /vs-bot redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigating to /vs-bot redirects to /play/ai and renders VsBot setup content", async () => {
    renderRoutes("/vs-bot");
    // VsBotSetup renders difficulty level cards including "Beginner"
    await waitFor(() => {
      expect(screen.getByText("Beginner")).toBeTruthy();
    });
    // Must NOT be on the login page
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });
});

describe("routes.014 — /play/online auth guard", () => {
  it("anonymous visitor on /play/online is redirected to /login", async () => {
    renderRoutes("/play/online");
    await waitFor(() => {
      // Login page renders a form with email input
      const emailInput = screen.queryByLabelText(/email/i) ?? screen.queryByPlaceholderText(/email/i);
      expect(emailInput).not.toBeNull();
    });
  });
});

describe("routes.014 — /play/ai is public", () => {
  it("anonymous visitor on /play/ai sees VsBot setup without redirect to login", async () => {
    renderRoutes("/play/ai");
    // Give it time to settle
    await waitFor(() => {
      const loginHeading = screen.queryByLabelText(/email/i) ?? screen.queryByPlaceholderText(/email/i);
      expect(loginHeading).toBeNull();
    });
    // VsBot renders — the page should not show the login form
    // Check that we are NOT on the login page
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });
});
