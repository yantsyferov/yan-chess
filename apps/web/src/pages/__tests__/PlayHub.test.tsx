// @layer: unit
// @spec: 014-play-redesign
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n/index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../components/game/Board", () => ({
  Board: () => <div data-testid="decorative-board" />,
}));

const _authState = { user: null as null | { id: string; nickname: string; email: string; createdAt: string } };

vi.mock("../../features/auth/useAuthStore", () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof _authState) => unknown) =>
      selector ? selector(_authState) : _authState,
    { getState: () => ({ ..._authState, clear: vi.fn(), setSession: vi.fn() }) },
  ),
}));

// ---------------------------------------------------------------------------
// Imports after vi.mock
// ---------------------------------------------------------------------------
import { PlayHub } from "../PlayHub";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderHub() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <PlayHub />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PlayHub — card order", () => {
  beforeEach(() => {
    _authState.user = null;
    vi.clearAllMocks();
  });

  it("renders exactly 4 mode cards in order: Online, vs Bot, vs Friend, vs Human on this computer", () => {
    renderHub();
    const links = screen.getAllByRole("link");
    // Filter to mode card links (href-bearing <a> tags)
    const hrefs = links.map((l) => l.getAttribute("href"));
    // Should contain all 4 destinations in order
    const cardHrefs = hrefs.filter((h) =>
      h === "/login" || h === "/play/online" || h === "/play/ai" || h === "/play/friend" || h === "/game"
    );
    expect(cardHrefs).toHaveLength(4);
  });
});

describe("PlayHub — anonymous user", () => {
  beforeEach(() => {
    _authState.user = null;
    vi.clearAllMocks();
  });

  it("Online card points to /login when anonymous", () => {
    renderHub();
    const onlineLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/login");
    expect(onlineLink).toBeDefined();
  });

  it("Bot card points to /play/ai when anonymous", () => {
    renderHub();
    const botLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/play/ai");
    expect(botLink).toBeDefined();
  });

  it("Friend card points to /login when anonymous (requiresAuth)", () => {
    renderHub();
    // Both Online and Friend should point to /login when anonymous
    const loginLinks = screen.getAllByRole("link").filter((l) => l.getAttribute("href") === "/login");
    expect(loginLinks).toHaveLength(2);
  });

  it("Hotseat card points to /game when anonymous", () => {
    renderHub();
    const hotseatLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/game");
    expect(hotseatLink).toBeDefined();
  });
});

describe("PlayHub — signed-in user", () => {
  beforeEach(() => {
    _authState.user = { id: "u1", nickname: "alice", email: "alice@test.com", createdAt: "2024-01-01" };
    vi.clearAllMocks();
  });

  it("Online card points to /play/online when signed in", () => {
    renderHub();
    const onlineLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/play/online");
    expect(onlineLink).toBeDefined();
  });

  it("Friend card points to /play/friend when signed in", () => {
    renderHub();
    const friendLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/play/friend");
    expect(friendLink).toBeDefined();
  });

  it("Bot card still points to /play/ai when signed in", () => {
    renderHub();
    const botLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/play/ai");
    expect(botLink).toBeDefined();
  });

  it("Hotseat card still points to /game when signed in", () => {
    renderHub();
    const hotseatLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/game");
    expect(hotseatLink).toBeDefined();
  });
});

describe("PlayHub — locale titles", () => {
  beforeEach(() => {
    _authState.user = null;
    vi.clearAllMocks();
  });

  it("renders English mode card titles by default", async () => {
    await i18n.changeLanguage("en");
    renderHub();
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("vs Bot")).toBeTruthy();
    expect(screen.getByText("vs Friend")).toBeTruthy();
    expect(screen.getByText("vs Human on this computer")).toBeTruthy();
  });

  it("renders Russian mode card titles when language is ru", async () => {
    await i18n.changeLanguage("ru");
    renderHub();
    expect(screen.getByText("Онлайн")).toBeTruthy();
    expect(screen.getByText("Против бота")).toBeTruthy();
    expect(screen.getByText("Против друга")).toBeTruthy();
    expect(screen.getByText("Против человека на этом компьютере")).toBeTruthy();
    await i18n.changeLanguage("en");
  });
});
