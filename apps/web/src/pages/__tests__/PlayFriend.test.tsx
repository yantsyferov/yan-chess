// @layer: unit
// @spec: 014-play-redesign
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n/index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../components/game/Board", () => ({
  Board: () => <div data-testid="decorative-board" />,
}));

// Minimal FriendListItem shape for tests
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

vi.mock("../../features/friends/useFriendsStore", () => ({
  useFriendsStore: Object.assign(
    (selector?: (s: typeof _friendsState & {
      openChallenge: typeof mockOpenChallenge;
      sendChallenge: typeof mockSendChallenge;
    }) => unknown) => {
      const state = {
        ..._friendsState,
        openChallenge: mockOpenChallenge,
        sendChallenge: mockSendChallenge,
      };
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

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

// ---------------------------------------------------------------------------
// Imports after vi.mock
// ---------------------------------------------------------------------------
import { PlayFriend } from "../PlayFriend";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <PlayFriend />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

const FAKE_FRIENDS = [
  { userId: "u1", nickname: "alice", blitzRating: 1500, online: true, friendedAt: "2024-01-01" },
  { userId: "u2", nickname: "bob", blitzRating: 1600, online: false, friendedAt: "2024-01-02" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PlayFriend — list view with friends", () => {
  beforeEach(() => {
    _friendsState.friends = [...FAKE_FRIENDS];
    vi.clearAllMocks();
  });

  it("renders decorative board", () => {
    renderPage();
    expect(screen.getByTestId("decorative-board")).toBeTruthy();
  });

  it("renders both friend rows in list view", () => {
    renderPage();
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("bob")).toBeTruthy();
  });

  it("renders a Challenge button for each friend", () => {
    renderPage();
    const challengeButtons = screen.getAllByRole("button", { name: /challenge/i });
    expect(challengeButtons.length).toBe(2);
  });
});

describe("PlayFriend — empty state", () => {
  beforeEach(() => {
    _friendsState.friends = [];
    vi.clearAllMocks();
  });

  it("shows empty state text when friends=[]", () => {
    renderPage();
    expect(screen.getByText(/no friends yet/i)).toBeTruthy();
  });

  it("shows a link to /friends in empty state", () => {
    renderPage();
    const links = screen.getAllByRole("link");
    const friendsLink = links.find((l) => l.getAttribute("href") === "/friends");
    expect(friendsLink).toBeDefined();
  });
});

describe("PlayFriend — challenge view", () => {
  beforeEach(() => {
    _friendsState.friends = [...FAKE_FRIENDS];
    vi.clearAllMocks();
  });

  it("clicking Challenge button for alice switches to challenge view showing alice's name", () => {
    renderPage();
    const challengeButtons = screen.getAllByRole("button", { name: /challenge/i });
    fireEvent.click(challengeButtons[0]);
    // alice's name should appear in the challenge form header
    expect(screen.getByText("alice")).toBeTruthy();
    // The Back to friends list link should appear
    expect(screen.getByText(/back to friends list/i)).toBeTruthy();
  });

  it("clicking Back to friends list returns to list view", () => {
    renderPage();
    const challengeButtons = screen.getAllByRole("button", { name: /challenge/i });
    fireEvent.click(challengeButtons[0]);
    const backBtn = screen.getByText(/back to friends list/i);
    fireEvent.click(backBtn);
    // Should be back to list view
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /challenge/i })).toHaveLength(2);
  });

  it("clicking Challenge link calls toast.info with the coming soon key", () => {
    renderPage();
    const challengeButtons = screen.getAllByRole("button", { name: /challenge/i });
    fireEvent.click(challengeButtons[0]);

    const challengeLinkBtn = screen.getByRole("button", { name: /challenge link/i });
    fireEvent.click(challengeLinkBtn);

    expect(mockToastInfo).toHaveBeenCalledWith("Shareable link coming soon");
  });
});

describe("PlayFriend — Send challenge payload", () => {
  beforeEach(() => {
    _friendsState.friends = [...FAKE_FRIENDS];
    vi.clearAllMocks();
  });

  it("clicking Send challenge with Rapid + Casual + Black calls sendChallenge with correct args", () => {
    renderPage();

    // Open challenge form for alice
    const challengeButtons = screen.getAllByRole("button", { name: /challenge/i });
    fireEvent.click(challengeButtons[0]);

    // Select Rapid mode
    const rapidBtn = screen.getByRole("button", { name: "Rapid" });
    fireEvent.click(rapidBtn);

    // Select Casual
    const casualBtn = screen.getByRole("button", { name: /casual/i });
    fireEvent.click(casualBtn);

    // Select Black
    const blackBtn = screen.getByRole("button", { name: /black/i });
    fireEvent.click(blackBtn);

    // Click Send challenge
    const sendBtn = screen.getByRole("button", { name: /send challenge/i });
    fireEvent.click(sendBtn);

    expect(mockOpenChallenge).toHaveBeenCalledWith("u1", "alice");
    expect(mockSendChallenge).toHaveBeenCalledWith("Rapid", "black", false);
  });
});
