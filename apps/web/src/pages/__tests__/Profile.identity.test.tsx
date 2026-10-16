// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "../../i18n/index";

// Mock authedFetch so no real HTTP calls are made
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuthedFetch = vi.fn((_path: string, _init?: RequestInit): any =>
  Promise.resolve({ status: 200, body: {} }),
);

vi.mock("../../features/auth/apiClient", () => ({
  authedFetch: (path: string, init?: RequestInit) => mockAuthedFetch(path, init),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

// Mock authService — prevent fetchMe network calls
vi.mock("../../features/auth/authService", () => ({
  fetchMe: vi.fn(() => Promise.resolve(null)),
  logout: vi.fn(() => Promise.resolve()),
}));

// Mock CountryPicker with a simple select for test interaction
vi.mock("../../features/profile/CountryPicker", () => ({
  CountryPicker: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (code: string) => void;
  }) => (
    <select
      data-testid="country-picker"
      aria-label="Country"
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
    >
      <option value="">Select country</option>
      <option value="MX">Mexico</option>
      <option value="FR">France</option>
    </select>
  ),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock GameHistorySection — heavy component not under test
vi.mock("../../features/history/GameHistorySection", () => ({
  GameHistorySection: () => <div data-testid="game-history-section" />,
}));

// Mock RatingTable
vi.mock("../../components/RatingTable", () => ({
  RatingTable: () => <div data-testid="rating-table" />,
}));

import { useAuthStore, type AuthUser } from "../../features/auth/useAuthStore";
import { Profile } from "../Profile";

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    nickname: "Alice",
    email: "alice@example.com",
    createdAt: "2024-01-01T00:00:00.000Z",
    country: null,
    ratings: [
      { mode: "Blitz" as const, rating: 1500, gamesPlayed: 10 },
    ],
    ...overrides,
  };
}

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockAuthedFetch.mockClear();
  mockNavigate.mockClear();
  useAuthStore.setState({ accessToken: "tok", user: baseUser() });
});

describe("Profile identity card", () => {
  it("renders the identity card with avatar and nickname when profile loads", () => {
    renderProfile();
    expect(screen.getByLabelText("avatar")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it('shows "International" + white flag when user.country is null', () => {
    useAuthStore.setState({ accessToken: "tok", user: baseUser({ country: null }) });
    renderProfile();
    const flags = screen.getAllByText("🏳");
    expect(flags.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/international/i)).toBeInTheDocument();
  });

  it("shows CountryPicker with MX selected when user.country === 'MX'", () => {
    useAuthStore.setState({ accessToken: "tok", user: baseUser({ country: "MX" }) });
    renderProfile();
    const picker = screen.getByTestId("country-picker") as HTMLSelectElement;
    expect(picker.value).toBe("MX");
  });

  it("calls authedFetch PATCH /users/me with { country: 'FR' } when country changes", async () => {
    useAuthStore.setState({ accessToken: "tok", user: baseUser({ country: "MX" }) });
    renderProfile();

    const picker = screen.getByTestId("country-picker");
    await userEvent.selectOptions(picker, "FR");

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/users/me",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ country: "FR" }),
        }),
      );
    });
  });

  it("keeps ratings table and game history below the identity card", () => {
    renderProfile();
    expect(screen.getByTestId("rating-table")).toBeInTheDocument();
    expect(screen.getByTestId("game-history-section")).toBeInTheDocument();
  });
});
