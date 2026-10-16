// @layer: unit
// @spec: 013-sidebar-layout

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/index";
import { AppShell } from "../AppShell";

// Mock all store and service deps to prevent network calls
vi.mock("../../../features/auth/useAuthStore", () => ({
  useAuthStore: Object.assign(
    (selector: (s: { user: null }) => unknown) => selector({ user: null }),
    { getState: () => ({ user: null }) },
  ),
}));
vi.mock("../../../features/friends/useFriendsStore", () => ({
  useFriendsStore: Object.assign(
    (selector: (s: { pendingRequestsCount: number }) => unknown) =>
      selector({ pendingRequestsCount: 0 }),
    { getState: () => ({ wire: vi.fn(), pendingRequestsCount: 0 }) },
  ),
  resetFriendsStore: vi.fn(),
}));
vi.mock("../../../features/auth/authService", () => ({
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  fetchMe: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerifyEmail: vi.fn(),
}));
vi.mock("../../../features/online/socket", () => ({
  disconnectSocket: vi.fn(),
  getSocket: vi.fn(),
  resetSocket: vi.fn(),
}));
vi.mock("../../../features/friends/friends-socket", () => ({
  disconnectFriendsSocket: vi.fn(),
  getFriendsSocket: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), off: vi.fn() })),
}));

function renderShell(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nextProvider i18n={i18n}>
        <AppShell>
          <div>page content</div>
        </AppShell>
      </I18nextProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Auth routes — sidebar must NOT be in the DOM
// ---------------------------------------------------------------------------

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

describe("AppShell hides sidebar on auth routes", () => {
  for (const route of AUTH_ROUTES) {
    it(`sidebar is NOT in the DOM on ${route}`, () => {
      renderShell(route);
      expect(screen.queryByRole("navigation")).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// Main app routes — sidebar must be present
// ---------------------------------------------------------------------------

describe("AppShell shows sidebar on main app routes", () => {
  it("sidebar is in the DOM on /play", () => {
    renderShell("/play");
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBeGreaterThan(0);
  });
});
