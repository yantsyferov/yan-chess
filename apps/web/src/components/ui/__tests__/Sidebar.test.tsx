// @layer: unit
// @spec: 013-sidebar-layout

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/index";
import type { AuthUser } from "../../../features/auth/useAuthStore";

// ---------------------------------------------------------------------------
// Mock authService
// ---------------------------------------------------------------------------
const mockLogout = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../features/auth/authService", () => ({
  logout: () => mockLogout(),
  login: vi.fn(),
  register: vi.fn(),
  fetchMe: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerifyEmail: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock socket deps to prevent network calls during tests
// ---------------------------------------------------------------------------
vi.mock("../../../features/online/socket", () => ({
  disconnectSocket: vi.fn(),
  getSocket: vi.fn(),
  resetSocket: vi.fn(),
}));
vi.mock("../../../features/friends/friends-socket", () => ({
  disconnectFriendsSocket: vi.fn(),
  getFriendsSocket: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), off: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// Mutable state controlled per-test
// ---------------------------------------------------------------------------
const mockUser: AuthUser = {
  id: "u1",
  nickname: "TestUser",
  email: "test@example.com",
  createdAt: "2024-01-01T00:00:00Z",
  country: null,
};

let _storeUser: AuthUser | null = null;
let _pendingCount = 0;

vi.mock("../../../features/auth/useAuthStore", () => ({
  useAuthStore: Object.assign(
    (selector: (s: { user: AuthUser | null }) => unknown) =>
      selector({ user: _storeUser }),
    { getState: () => ({ user: _storeUser, clear: vi.fn(), setSession: vi.fn() }) },
  ),
}));

vi.mock("../../../features/friends/useFriendsStore", () => ({
  useFriendsStore: Object.assign(
    (selector: (s: { pendingRequestsCount: number }) => unknown) =>
      selector({ pendingRequestsCount: _pendingCount }),
    { getState: () => ({ wire: vi.fn(), pendingRequestsCount: _pendingCount }) },
  ),
  resetFriendsStore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Static import — must be after all vi.mock() calls
// ---------------------------------------------------------------------------
import { Sidebar } from "../Sidebar";

function renderSidebar(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nextProvider i18n={i18n}>
        <Sidebar />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  _storeUser = null;
  _pendingCount = 0;
  mockLogout.mockClear();
});

// ---------------------------------------------------------------------------
// Anonymous bottom
// ---------------------------------------------------------------------------

describe("SidebarAnonymousBottom", () => {
  it("shows Login and Register buttons when not signed in", () => {
    _storeUser = null;
    renderSidebar();
    expect(screen.getByRole("link", { name: /sign in|log ?in|войти/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up|register|регистрация/i })).toBeInTheDocument();
  });

  it("does NOT show avatar or action icons when not signed in", () => {
    _storeUser = null;
    renderSidebar();
    expect(screen.queryByLabelText("avatar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/settings|настройки/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Signed-in bottom
// ---------------------------------------------------------------------------

describe("SidebarSignedInBottom", () => {
  beforeEach(() => {
    _storeUser = mockUser;
  });

  it("shows avatar and nickname when signed in", () => {
    renderSidebar();
    expect(screen.getByLabelText("avatar")).toBeInTheDocument();
    expect(screen.getByText(mockUser.nickname)).toBeInTheDocument();
  });

  it("shows all 5 action icon buttons", () => {
    renderSidebar();
    expect(screen.getByLabelText(/settings|настройки/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/friends|друзья/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/chat|чат/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notif|уведомл/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sign out|logout|выйти|cerrar/i)).toBeInTheDocument();
  });

  it("Chat icon has cursor-not-allowed class", () => {
    renderSidebar();
    const chatBtn = screen.getByLabelText(/chat|чат/i);
    expect(chatBtn.className).toMatch(/cursor-not-allowed/);
  });

  it("Logout icon click calls authService.logout()", async () => {
    const user = userEvent.setup();
    renderSidebar();
    const logoutBtn = screen.getByLabelText(/sign out|logout|выйти|cerrar/i);
    await user.click(logoutBtn);
    await vi.waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Active-route highlight
// ---------------------------------------------------------------------------

describe("SidebarMenu active route", () => {
  it("Play menu item has aria-current=page when on /play", () => {
    _storeUser = null;
    renderSidebar("/play");
    const playLink = screen.getByRole("link", { name: /play|играть|jugar/i });
    expect(playLink).toHaveAttribute("aria-current", "page");
  });

  it("Play menu item has no aria-current when not on /play", () => {
    _storeUser = null;
    renderSidebar("/");
    const playLink = screen.getByRole("link", { name: /play|играть|jugar/i });
    expect(playLink).not.toHaveAttribute("aria-current");
  });
});
