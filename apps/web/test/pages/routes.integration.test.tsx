// @layer: integration
// @spec: 010-frontend-reliability
// @regression

/**
 * Integration tests for the AuthenticatedLayout navigation guard.
 *
 * The guard fires navigate("/play/online") only when BOTH conditions hold:
 *   gameId !== null AND pendingNavigate === true
 *
 * Four cases are tested:
 *   1. gameId set + pendingNavigate true  → navigate called once, flag cleared
 *   2. gameId set + pendingNavigate false → navigate NOT called
 *   3. gameId null + pendingNavigate true → navigate NOT called
 *   4. gameId null → gameId set (while pendingNavigate true) → navigate fires on change
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import { useOnlineGameStore } from "../../src/features/online/useOnlineGameStore";

// ---------------------------------------------------------------------------
// Mock useNavigate — captured per-render via the factory.
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Mock heavy side-effects that AuthenticatedLayout triggers on mount.
// ---------------------------------------------------------------------------
vi.mock("../../src/features/friends/useFriendsStore", () => ({
  useFriendsStore: {
    getState: () => ({ wire: vi.fn().mockResolvedValue(undefined) }),
    subscribe: vi.fn(() => () => {}),
  },
  resetFriendsStore: vi.fn(),
}));

vi.mock("../../src/features/online/useOnlineGameStore", async (importOriginal) => {
  // Keep the real store — we need it to test state transitions.
  const actual = await importOriginal<typeof import("../../src/features/online/useOnlineGameStore")>();
  return {
    ...actual,
    // Override wireOnlineGameSocket to be a no-op (avoids socket.io connection).
    wireOnlineGameSocket: vi.fn(),
  };
});

// FriendsNotificationLayer renders children of AuthenticatedLayout — mock away UI.
vi.mock("../../src/features/friends/FriendsNotificationLayer", () => ({
  FriendsNotificationLayer: () => null,
}));

// ---------------------------------------------------------------------------
// Re-import routes AFTER mocks.
// The component we test is AuthenticatedLayout inside AppRoutes.
// We render it directly via a local wrapper that bypasses ProtectedRoute.
// ---------------------------------------------------------------------------
// AuthenticatedLayout is not exported; import via the module and render
// by mounting AppRoutes with MemoryRouter, OR extract only the effect logic.
// Strategy: import the named AuthenticatedLayout-equivalent logic by
// rendering AppRoutes at "/" inside a MemoryRouter — the layout wraps
// the "/" Route and will run the effect.
//
// However, ProtectedRoute checks auth and may redirect.  Simpler approach:
// directly import only the parts we need from routes.tsx by factoring the
// effect into the test — OR we mock ProtectedRoute.
// We choose to mock ProtectedRoute to just render its children.
// ---------------------------------------------------------------------------
vi.mock("../../src/features/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Lazy-loaded pages are mocked to trivial components to avoid dynamic imports.
vi.mock("../../src/pages/Play", () => ({ Play: () => <div data-testid="play-page" /> }));
vi.mock("../../src/pages/VsBot", () => ({ VsBot: () => <div data-testid="vs-bot-page" /> }));
vi.mock("../../src/pages/HistoryReplay", () => ({ HistoryReplay: () => <div /> }));
vi.mock("../../src/pages/Friends", () => ({ Friends: () => <div /> }));
vi.mock("../../src/pages/Game", () => ({ default: () => <div /> }));
vi.mock("../../src/pages/Home", () => ({ Home: () => <div data-testid="home-page" /> }));
vi.mock("../../src/pages/Profile", () => ({ Profile: () => <div /> }));
vi.mock("../../src/pages/Register", () => ({ Register: () => <div /> }));
vi.mock("../../src/pages/Login", () => ({ Login: () => <div /> }));
vi.mock("../../src/pages/VerifyEmailCheck", () => ({ VerifyEmailCheck: () => <div /> }));
vi.mock("../../src/pages/VerifyEmail", () => ({ VerifyEmail: () => <div /> }));
vi.mock("../../src/pages/ForgotPassword", () => ({ ForgotPassword: () => <div /> }));
vi.mock("../../src/pages/ResetPassword", () => ({ ResetPassword: () => <div /> }));

import { AppRoutes } from "../../src/routes";

// ---------------------------------------------------------------------------
// Helper: render AppRoutes at "/" and optionally seed store state.
// ---------------------------------------------------------------------------
function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  // Full reset so each test starts from a known state.
  useOnlineGameStore.getState().reset();
});

afterEach(() => {
  useOnlineGameStore.getState().reset();
});

// ---------------------------------------------------------------------------

describe("AuthenticatedLayout – navigation guard effect", () => {
  // @regression
  it('Case 1: gameId set + pendingNavigate true → navigate("/play/online") called and flag cleared', async () => {
    renderLayout();

    await act(async () => {
      useOnlineGameStore.getState().markPendingNavigate();
      useOnlineGameStore.setState({ gameId: "game-x" });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/play/online");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  // @regression
  it("Case 2: gameId set + pendingNavigate false → navigate NOT called", async () => {
    renderLayout();

    await act(async () => {
      // pendingNavigate stays false (default)
      useOnlineGameStore.setState({ gameId: "game-x" });
    });

    expect(mockNavigate).not.toHaveBeenCalledWith("/play/online");
  });

  // @regression
  it("Case 3: gameId null + pendingNavigate true → navigate NOT called", async () => {
    renderLayout();

    await act(async () => {
      useOnlineGameStore.getState().markPendingNavigate();
      // gameId stays null
    });

    expect(mockNavigate).not.toHaveBeenCalledWith("/play/online");
  });

  // @regression
  it("Case 4: gameId transitions from null to set while pendingNavigate true → navigate fires", async () => {
    renderLayout();

    await act(async () => {
      useOnlineGameStore.getState().markPendingNavigate();
    });

    // Confirm no premature navigation while gameId is still null.
    expect(mockNavigate).not.toHaveBeenCalledWith("/play/online");

    await act(async () => {
      useOnlineGameStore.setState({ gameId: "game-y" });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/play/online");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("negative: navigate is NOT called when both conditions are false initially", async () => {
    renderLayout();

    // Default state: gameId=null, pendingNavigate=false — just wait a tick.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockNavigate).not.toHaveBeenCalledWith("/play/online");
  });
});
