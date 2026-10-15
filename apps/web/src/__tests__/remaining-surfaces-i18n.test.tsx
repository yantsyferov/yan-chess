// @layer: integration
// @spec: 012-i18n
// @regression

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n/index";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useLocation: () => ({ pathname: "/", search: "", hash: "", state: null, key: "default" }),
    useParams: () => ({ gameId: "test-game" }),
  };
});

vi.mock("../features/auth/authService", () => ({
  logout: vi.fn(),
  fetchMe: vi.fn(),
}));

vi.mock("../features/auth/useAuthStore", () => ({
  useAuthStore: vi.fn().mockReturnValue({
    user: {
      nickname: "TestUser",
      createdAt: "2024-01-01T00:00:00.000Z",
      ratings: [{ mode: "Blitz", rating: 1600 }],
    },
  }),
}));

vi.mock("../features/history/useGamesList", () => ({
  useGamesList: () => ({
    games: [],
    pagination: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const FRIENDS_STATE = { friends: [], searchResults: [], searchLoading: false, pendingInbound: [] };
vi.mock("../features/friends/useFriendsStore", () => ({
  useFriendsStore: (selector: ((s: typeof FRIENDS_STATE) => unknown) | undefined) =>
    selector ? selector(FRIENDS_STATE) : FRIENDS_STATE,
}));

import { Profile } from "../pages/Profile";
import { Friends } from "../pages/Friends";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("ru");
  });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("Profile — Russian labels (Slice 4)", () => {
  it("renders ratings title in Russian", () => {
    renderWithProviders(<Profile />);
    expect(screen.getByText("Рейтинг")).toBeInTheDocument();
  });

  it("renders sign out button in Russian", () => {
    renderWithProviders(<Profile />);
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
  });
});

describe("Friends — Russian labels (Slice 4)", () => {
  it("renders page title in Russian (h1)", () => {
    renderWithProviders(<Friends />);
    expect(screen.getByRole("heading", { name: "Друзья" })).toBeInTheDocument();
  });

  it("renders tab labels in Russian", () => {
    renderWithProviders(<Friends />);
    expect(screen.getByText("Заявки")).toBeInTheDocument();
    expect(screen.getByText("Поиск")).toBeInTheDocument();
  });
});
