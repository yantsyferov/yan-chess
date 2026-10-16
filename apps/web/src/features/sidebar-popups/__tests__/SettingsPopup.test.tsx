// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n/index";

const mockNavigate = vi.fn();
const mockLogout = vi.fn(() => Promise.resolve());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../auth/authService", () => ({
  logout: () => mockLogout(),
}));

// Lightweight stubs for the reused components
vi.mock("../../i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

vi.mock("../../../components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

import { SettingsPopup } from "../SettingsPopup";

function renderSettingsPopup() {
  return render(
    <MemoryRouter>
      <SettingsPopup />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsPopup", () => {
  it("renders LanguageSwitcher", () => {
    renderSettingsPopup();
    expect(screen.getByTestId("language-switcher")).toBeTruthy();
  });

  it("renders ThemeToggle", () => {
    renderSettingsPopup();
    expect(screen.getByTestId("theme-toggle")).toBeTruthy();
  });

  it("renders a Sign out button", () => {
    renderSettingsPopup();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
  });

  it("Sign out button calls authService.logout() and navigates to /login", async () => {
    renderSettingsPopup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });
});
