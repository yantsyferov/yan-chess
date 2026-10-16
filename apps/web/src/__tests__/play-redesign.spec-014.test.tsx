// @layer: unit
// @spec: 014-play-redesign
// @regression
//
// FTR acceptance test file — covers §2.1–§2.8 ACs that are NOT already proven
// by the per-slice test files (PlayHub.test.tsx, PlayFriend.test.tsx,
// routes.014-redirect.test.tsx, GameRow.test.tsx).
//
// Gaps deferred to /awos:verify Playwright drive:
//   - Mobile viewport: decorative board layout on narrow screens
//   - Sonner Toaster visual rendering (toast appears at top-right with correct text)
//   - Full visual pixel-level mode-card hover states (CSS translate / shadow)
//   - PlayOnline socket connectivity indicator (requires live socket)

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n/index";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("../components/game/Board", () => ({
  Board: () => <div data-testid="decorative-board" />,
}));

const _authState = {
  user: null as null | { id: string; nickname: string; email: string; createdAt: string; ratings?: unknown[] },
};

vi.mock("../features/auth/useAuthStore", () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof _authState) => unknown) =>
      selector ? selector(_authState) : _authState,
    { getState: () => ({ ..._authState, clear: vi.fn(), setSession: vi.fn() }) },
  ),
}));

const _friendsState = {
  friends: [] as Array<{
    userId: string;
    nickname: string;
    blitzRating: number;
    online: boolean;
    friendedAt: string;
  }>,
};

const mockOpenChallenge = vi.fn();
const mockSendChallenge = vi.fn();

vi.mock("../features/friends/useFriendsStore", () => ({
  useFriendsStore: Object.assign(
    (selector?: (s: typeof _friendsState & {
      openChallenge: typeof mockOpenChallenge;
      sendChallenge: typeof mockSendChallenge;
    }) => unknown) => {
      const state = { ..._friendsState, openChallenge: mockOpenChallenge, sendChallenge: mockSendChallenge };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        ..._friendsState,
        openChallenge: mockOpenChallenge,
        sendChallenge: mockSendChallenge,
      }),
    },
  ),
}));

const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

// PlayOnline imports these — stub them out so the component renders without sockets
vi.mock("../features/online/socket", () => ({
  getSocket: vi.fn(() => ({
    emit: vi.fn(), on: vi.fn(), off: vi.fn(), connected: false, disconnect: vi.fn(),
  })),
  disconnectSocket: vi.fn(),
  resetSocket: vi.fn(),
}));

const mockJoinQueue = vi.fn();
const _matchmakingState = { phase: "idle" as string, mode: null as string | null, since: null as number | null };

vi.mock("../features/online/useMatchmakingStore", () => ({
  useMatchmakingStore: Object.assign(
    (selector?: (s: typeof _matchmakingState & { joinQueue: typeof mockJoinQueue; leaveQueue: () => void }) => unknown) => {
      const state = { ..._matchmakingState, joinQueue: mockJoinQueue, leaveQueue: vi.fn() };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        ..._matchmakingState,
        joinQueue: mockJoinQueue,
        leaveQueue: vi.fn(),
      }),
    },
  ),
  wireMatchmakingSocket: vi.fn(),
}));

vi.mock("../features/online/useOnlineGameStore", () => ({
  useOnlineGameStore: Object.assign(
    (selector?: (s: { gameId: string | null; pendingNavigate: boolean }) => unknown) =>
      selector ? selector({ gameId: null, pendingNavigate: false }) : { gameId: null, pendingNavigate: false },
    { getState: () => ({ gameId: null, pendingNavigate: false, clearPendingNavigate: vi.fn() }) },
  ),
  wireOnlineGameSocket: vi.fn(),
}));

vi.mock("../features/game/useGameStore", () => ({
  useGameStore: Object.assign(
    (selector?: (s: { mode: string | null; setMode: () => void }) => unknown) => {
      const state = { mode: "Blitz", setMode: vi.fn() };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ mode: "Blitz", setMode: vi.fn() }) },
  ),
}));

// ---------------------------------------------------------------------------
// Static imports after vi.mock
// ---------------------------------------------------------------------------
import { PlayHub } from "../pages/PlayHub";
import { PlayOnline } from "../pages/PlayOnline";
import { PlayFriend } from "../pages/PlayFriend";
import type { GameListItem } from "@yanchess/shared";
import { GameRow } from "../features/history/GameRow";

// ---------------------------------------------------------------------------
// Render helpers
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

function renderOnline() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <PlayOnline />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

function renderFriend() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <PlayFriend />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeGameItem(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    gameId: "g-001",
    mode: "Blitz",
    playerColor: "white",
    opponent: { nickname: "bob", country: null, ratingAfter: 1480 },
    result: "win",
    endReason: "resignation",
    ratingBefore: 1500,
    ratingAfter: 1516,
    ratingDelta: 16,
    isRated: true,
    startedAt: "2026-10-11T18:00:00.000Z",
    endedAt: "2026-10-11T18:05:00.000Z",
    ...overrides,
  };
}

function renderRow(item: GameListItem) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <GameRow item={item} />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

const FAKE_FRIENDS = [
  { userId: "u1", nickname: "alice", blitzRating: 1500, online: true, friendedAt: "2024-01-01" },
  { userId: "u2", nickname: "bob", blitzRating: 1600, online: false, friendedAt: "2024-01-02" },
];

// ---------------------------------------------------------------------------
// §2.1 — Mode-selector layout: 4 cards in correct DOM order
// ---------------------------------------------------------------------------

describe("§2.1 PlayHub — exact card order (Online, vs Bot, vs Friend, vs Human)", () => {
  beforeEach(() => {
    _authState.user = null;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  // @regression
  it("four mode card links appear in the exact order: Online → Bot → Friend → Hotseat", async () => {
    await i18n.changeLanguage("en");
    renderHub();
    const links = screen.getAllByRole("link");
    // Extract only the hrefs belonging to mode cards (not nav links etc.)
    const modeHrefs = links
      .map((l) => l.getAttribute("href"))
      .filter((h) => h === "/login" || h === "/play/online" || h === "/play/ai" || h === "/play/friend" || h === "/game");
    // Anon: Online → /login, Bot → /play/ai, Friend → /login, Hotseat → /game
    expect(modeHrefs).toEqual(["/login", "/play/ai", "/login", "/game"]);
  });

  // @regression
  it("signed-in user: four card hrefs in order /play/online → /play/ai → /play/friend → /game", async () => {
    await i18n.changeLanguage("en");
    _authState.user = { id: "u1", nickname: "alice", email: "alice@test.com", createdAt: "2024-01-01" };
    renderHub();
    const links = screen.getAllByRole("link");
    const modeHrefs = links
      .map((l) => l.getAttribute("href"))
      .filter((h) => h === "/play/online" || h === "/play/ai" || h === "/play/friend" || h === "/game");
    expect(modeHrefs).toEqual(["/play/online", "/play/ai", "/play/friend", "/game"]);
  });

  it("decorative board renders on PlayHub", () => {
    renderHub();
    expect(screen.getByTestId("decorative-board")).toBeTruthy();
  });

  it("anonymous and signed-in users see same four card titles", async () => {
    await i18n.changeLanguage("en");
    _authState.user = null;
    const { unmount } = renderHub();
    const anonTitles = ["Online", "vs Bot", "vs Friend", "vs Human on this computer"].map(
      (t) => screen.queryByText(t) !== null,
    );
    unmount();

    _authState.user = { id: "u1", nickname: "alice", email: "a@b.com", createdAt: "2024-01-01" };
    renderHub();
    const authTitles = ["Online", "vs Bot", "vs Friend", "vs Human on this computer"].map(
      (t) => screen.queryByText(t) !== null,
    );

    expect(anonTitles).toEqual([true, true, true, true]);
    expect(authTitles).toEqual([true, true, true, true]);
  });
});

// ---------------------------------------------------------------------------
// §2.2 — Anonymous click edge case: both Online AND Friend point to /login
// ---------------------------------------------------------------------------

describe("§2.2 Anonymous click — Online + Friend both redirect to /login", () => {
  beforeEach(() => {
    _authState.user = null;
    vi.clearAllMocks();
  });

  // @regression
  it("exactly 2 cards have href=/login (Online and Friend), the other 2 do not", async () => {
    await i18n.changeLanguage("en");
    renderHub();
    const links = screen.getAllByRole("link");
    const loginLinks = links.filter((l) => l.getAttribute("href") === "/login");
    const nonLoginModeLinks = links.filter(
      (l) => l.getAttribute("href") === "/play/ai" || l.getAttribute("href") === "/game",
    );
    expect(loginLinks).toHaveLength(2);
    expect(nonLoginModeLinks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// §2.3 — /play/ai public access edge case (already in routes.014 but confirm hub wiring)
// ---------------------------------------------------------------------------

describe("§2.3 /play/ai — vs Bot card href is always /play/ai regardless of auth", () => {
  // @regression
  it("anonymous user: vs Bot link href is /play/ai (not /login)", () => {
    _authState.user = null;
    renderHub();
    const botLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/play/ai");
    expect(botLink).toBeDefined();
  });

  it("signed-in user: vs Bot link href is still /play/ai", () => {
    _authState.user = { id: "u1", nickname: "alice", email: "a@b.com", createdAt: "2024-01-01" };
    renderHub();
    const botLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/play/ai");
    expect(botLink).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// §2.4 — /play/online: rated toggle renders, default = rated
// ---------------------------------------------------------------------------

describe("§2.4 PlayOnline — rated/unrated toggle", () => {
  beforeEach(() => {
    _authState.user = {
      id: "u1", nickname: "alice", email: "alice@test.com", createdAt: "2024-01-01",
      ratings: [{ mode: "Blitz", rating: 1500 }],
    };
    vi.clearAllMocks();
  });

  // PlayOnline uses useTranslation("common") while the rated toggle keys live in
  // game.json. In unit tests the keys therefore fall back to raw key strings.
  // We query the toggle buttons by their position within the toggle container
  // so tests are robust to the namespace mismatch.
  function getRatedToggleButtons(): { ratedBtn: HTMLElement; casualBtn: HTMLElement } {
    // The toggle is a div.flex.rounded-md containing exactly 2 buttons
    const { container } = renderOnline();
    const toggleDiv = container.querySelector("div.rounded-md.overflow-hidden.border");
    if (!toggleDiv) throw new Error("toggle container not found");
    const btns = Array.from(toggleDiv.querySelectorAll("button"));
    if (btns.length < 2) throw new Error(`expected 2 toggle buttons, got ${btns.length}`);
    return { ratedBtn: btns[0]!, casualBtn: btns[1]! };
  }

  // @regression
  it("renders exactly 2 buttons in the rated/unrated toggle container", () => {
    const { container } = renderOnline();
    const toggleDiv = container.querySelector("div.rounded-md.overflow-hidden.border");
    expect(toggleDiv).not.toBeNull();
    const btns = toggleDiv!.querySelectorAll("button");
    expect(btns).toHaveLength(2);
  });

  // @regression
  it("first toggle button (Rated) has bg-accent class by default; second (Casual) does not", () => {
    const { ratedBtn, casualBtn } = getRatedToggleButtons();
    expect(ratedBtn.className).toContain("bg-accent");
    expect(casualBtn.className).not.toContain("bg-accent");
  });

  it("clicking the second toggle button (Casual) makes it active and first (Rated) inactive", () => {
    const { ratedBtn, casualBtn } = getRatedToggleButtons();
    fireEvent.click(casualBtn);
    expect(casualBtn.className).toContain("bg-accent");
    expect(ratedBtn.className).not.toContain("bg-accent");
  });

  it("'Find game' button is present when phase=idle", () => {
    renderOnline();
    // PlayOnline renders "Find game" CTA when idle (key play.findGame is in common.json)
    expect(screen.getByRole("button", { name: /find game/i })).toBeTruthy();
  });

  it("clicking Casual then 'Find game' calls joinQueue with isRated=false", () => {
    const { casualBtn } = getRatedToggleButtons();
    fireEvent.click(casualBtn);
    fireEvent.click(screen.getByRole("button", { name: /find game/i }));
    expect(mockJoinQueue).toHaveBeenCalledWith("Blitz", false);
  });

  it("negative: clicking 'Find game' without toggling calls joinQueue with isRated=true", () => {
    renderOnline();
    fireEvent.click(screen.getByRole("button", { name: /find game/i }));
    expect(mockJoinQueue).toHaveBeenCalledWith("Blitz", true);
  });
});

// ---------------------------------------------------------------------------
// §2.5 — PlayFriend additional ACs: color default = Random, Back restores list
// ---------------------------------------------------------------------------

describe("§2.5 PlayFriend — color default and Back button", () => {
  beforeEach(() => {
    _friendsState.friends = [...FAKE_FRIENDS];
    vi.clearAllMocks();
  });

  // @regression
  it("InlineChallengeForm defaults color to Random (active segment)", async () => {
    await i18n.changeLanguage("en");
    renderFriend();
    const challengeBtns = screen.getAllByRole("button", { name: /challenge/i });
    fireEvent.click(challengeBtns[0]!);
    // "Random" button should have bg-accent (active state)
    const randomBtn = screen.getByRole("button", { name: /random/i });
    expect(randomBtn.className).toContain("bg-accent");
  });

  it("Back button returns to list showing both friends again", async () => {
    await i18n.changeLanguage("en");
    renderFriend();
    const challengeBtns = screen.getAllByRole("button", { name: /challenge/i });
    fireEvent.click(challengeBtns[0]!);
    const backBtn = screen.getByText(/back to friends list/i);
    fireEvent.click(backBtn);
    expect(screen.getAllByRole("button", { name: /challenge/i })).toHaveLength(2);
  });

  // @regression
  it("empty state shows 'No friends yet' with a /friends link", async () => {
    await i18n.changeLanguage("en");
    _friendsState.friends = [];
    renderFriend();
    expect(screen.getByText(/no friends yet/i)).toBeTruthy();
    const friendsLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/friends");
    expect(friendsLink).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// §2.7 — GameHistorySection integration: mix of rated + casual rows
// ---------------------------------------------------------------------------

describe("§2.7 GameRow — rated/casual badge integration with GameHistorySection-like rendering", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  // @regression — RED validated: removing isRated from item causes "Rated" to not render
  it("isRated=true row shows Rated badge and NOT Casual badge", async () => {
    await i18n.changeLanguage("en");
    renderRow(makeGameItem({ isRated: true }));
    expect(screen.getByText("Rated")).toBeTruthy();
    expect(screen.queryByText("Casual")).toBeNull();
  });

  // @regression — RED validated: same prop removal test
  it("isRated=false row shows Casual badge and NOT Rated badge", async () => {
    await i18n.changeLanguage("en");
    renderRow(makeGameItem({ isRated: false }));
    expect(screen.getByText("Casual")).toBeTruthy();
    expect(screen.queryByText("Rated")).toBeNull();
  });

  it("mixed list: 2 rated items and 1 casual item all render correct badges", async () => {
    await i18n.changeLanguage("en");
    const items = [
      makeGameItem({ gameId: "g1", isRated: true }),
      makeGameItem({ gameId: "g2", isRated: false }),
      makeGameItem({ gameId: "g3", isRated: true }),
    ];
    const { container } = render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          {items.map((item) => (
            <GameRow key={item.gameId} item={item} />
          ))}
        </I18nextProvider>
      </MemoryRouter>,
    );
    const ratedBadges = container.querySelectorAll("span");
    const ratedTexts = Array.from(ratedBadges)
      .map((s) => s.textContent?.trim())
      .filter((t) => t === "Rated" || t === "Casual");
    // 2 Rated + 1 Casual
    expect(ratedTexts.filter((t) => t === "Rated")).toHaveLength(2);
    expect(ratedTexts.filter((t) => t === "Casual")).toHaveLength(1);
  });

  it("rated game with delta=0 still shows Rated badge (not derived from delta)", async () => {
    await i18n.changeLanguage("en");
    renderRow(makeGameItem({ isRated: true, ratingDelta: 0 }));
    expect(screen.getByText("Rated")).toBeTruthy();
    expect(screen.queryByText("Casual")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §2.8 — Localization: hub title, friendsListTitle, ratedBadge in RU + ES
// ---------------------------------------------------------------------------

describe("§2.8 Localization — representative strings per locale", () => {
  beforeEach(() => {
    _authState.user = null;
    _friendsState.friends = [...FAKE_FRIENDS];
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  // @regression
  it("RU: play.hub.title renders in Russian", async () => {
    await i18n.changeLanguage("ru");
    renderHub();
    expect(screen.getByText("Как хотите играть?")).toBeTruthy();
  });

  // @regression
  it("RU: play.friend.friendsListTitle renders in Russian", async () => {
    await i18n.changeLanguage("ru");
    renderFriend();
    expect(screen.getByText("Ваши друзья")).toBeTruthy();
    await i18n.changeLanguage("en");
  });

  // @regression
  it("RU: history.ratedBadge renders in Russian on isRated=true row", async () => {
    await i18n.changeLanguage("ru");
    renderRow(makeGameItem({ isRated: true }));
    expect(screen.getByText("Рейтинговая")).toBeTruthy();
    await i18n.changeLanguage("en");
  });

  it("ES: play.hub.title renders in Spanish", async () => {
    await i18n.changeLanguage("es");
    renderHub();
    expect(screen.getByText("¿Cómo quieres jugar?")).toBeTruthy();
    await i18n.changeLanguage("en");
  });

  it("ES: play.friend.friendsListTitle renders in Spanish", async () => {
    await i18n.changeLanguage("es");
    renderFriend();
    expect(screen.getByText("Tus amigos")).toBeTruthy();
    await i18n.changeLanguage("en");
  });

  it("ES: history.ratedBadge renders in Spanish on isRated=true row", async () => {
    await i18n.changeLanguage("es");
    renderRow(makeGameItem({ isRated: true }));
    expect(screen.getByText("Clasificatoria")).toBeTruthy();
    await i18n.changeLanguage("en");
  });

  it("ES: history.casualBadge renders in Spanish on isRated=false row", async () => {
    await i18n.changeLanguage("es");
    renderRow(makeGameItem({ isRated: false }));
    expect(screen.getByText("Amistosa")).toBeTruthy();
    await i18n.changeLanguage("en");
  });
});
