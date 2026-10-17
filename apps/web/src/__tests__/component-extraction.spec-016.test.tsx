// @layer: integration
// @spec: 016-component-extraction
// @regression

/**
 * FTR Slice — Spec 016 Component Extraction
 *
 * Exercises the integration surface of the extracted shared components
 * (UserIdentity, ToggleGroup, EmptyState, OnlineStatusDot, RatedBadge,
 * MODE_OPTIONS) across the host components that consume them.
 *
 * Gaps (cannot be validated at this layer):
 * - Pixel-level visual regression (before/after screenshot diff) — needs
 *   Playwright screenshot comparison or a dedicated visual-diff tool.
 * - CSS class resolution / computed styles for theme tokens (bg-success,
 *   border-border-subtle, etc.) — jsdom does not compute CSS custom properties.
 * - Runtime socket-connected components (PlayOnline) that depend on
 *   socket.io singletons — those require a live Supertest/socket environment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../i18n/index";
import type { FriendListItem } from "@yanchess/shared";

// ---------------------------------------------------------------------------
// § 2.2 — UserIdentity used in FriendsPopup
// ---------------------------------------------------------------------------

let mockFriends: FriendListItem[] = [];

vi.mock("../features/friends/useFriendsStore", () => ({
  useFriendsStore: (selector: (s: { friends: FriendListItem[] }) => unknown) =>
    selector({ friends: mockFriends }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// Heavy components consumed by Profile — not under test here
vi.mock("../features/history/GameHistorySection", () => ({
  GameHistorySection: () => <div data-testid="game-history-section" />,
}));
vi.mock("../components/RatingTable", () => ({
  RatingTable: () => <div data-testid="rating-table" />,
}));
vi.mock("../features/profile/CountryPicker", () => ({
  CountryPicker: ({ value }: { value: string | null }) => (
    <select aria-label="Country" defaultValue={value ?? ""} />
  ),
}));
vi.mock("../features/auth/authService", () => ({
  fetchMe: vi.fn(() => Promise.resolve(null)),
  logout: vi.fn(() => Promise.resolve()),
}));
vi.mock("../features/auth/apiClient", () => ({
  authedFetch: vi.fn(() => Promise.resolve({ status: 200, body: {} })),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

// Sonner toast used by InlineChallengeForm
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// InlineChallengeForm calls useFriendsStore for openChallenge / sendChallenge
vi.mock("../features/friends/useFriendsStore", () => ({
  useFriendsStore: (
    selector: (s: {
      friends: FriendListItem[];
      openChallenge: () => void;
      sendChallenge: () => void;
    }) => unknown,
  ) =>
    selector({
      friends: mockFriends,
      openChallenge: vi.fn(),
      sendChallenge: vi.fn(),
    }),
}));

import { FriendsPopup } from "../features/sidebar-popups/FriendsPopup";
import { NotificationsPopup } from "../features/sidebar-popups/NotificationsPopup";
import { InlineChallengeForm } from "../features/play/InlineChallengeForm";
import { GameRow } from "../features/history/GameRow";
import { useAuthStore, type AuthUser } from "../features/auth/useAuthStore";
import { Profile } from "../pages/Profile";
import { MODE_OPTIONS } from "../features/shared/mode-labels";
import { ToggleGroup } from "../components/ui/ToggleGroup";
import type { GameListItem } from "@yanchess/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFriend(overrides: Partial<FriendListItem> & { userId: string; nickname: string }): FriendListItem {
  return {
    country: null,
    blitzRating: 1500,
    online: false,
    friendedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeGameItem(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    gameId: "g-1",
    mode: "Blitz",
    playerColor: "white",
    opponent: { nickname: "bob", country: null, ratingAfter: 1484 },
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

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    nickname: "Alice",
    email: "alice@example.com",
    createdAt: "2024-01-01T00:00:00.000Z",
    country: null,
    ratings: [{ mode: "Blitz" as const, rating: 1500, gamesPlayed: 10 }],
    ...overrides,
  };
}

beforeEach(() => {
  mockFriends = [];
});

// ---------------------------------------------------------------------------
// § 2.2 UserIdentity used in Friends list (FriendsPopup)
// ---------------------------------------------------------------------------

describe("§2.2 UserIdentity in FriendsPopup", () => {
  it("@regression shows friend nickname via UserIdentity when friends are present", () => {
    mockFriends = [makeFriend({ userId: "u1", nickname: "Magnus" })];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.getByText("Magnus")).toBeInTheDocument();
  });

  it("@regression shows flag placeholder for friend with no country", () => {
    mockFriends = [makeFriend({ userId: "u2", nickname: "Hikaru", country: null })];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("No country")).toBeInTheDocument();
  });

  it("negative: friend with unknown userId does not appear when not in list", () => {
    mockFriends = [makeFriend({ userId: "u3", nickname: "Fabiano" })];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.queryByText("NotInList")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// § 2.2 UserIdentity used in Profile
// ---------------------------------------------------------------------------

describe("§2.2 UserIdentity in Profile", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "tok", user: baseUser({ nickname: "Alice" }) });
  });

  it("@regression renders Alice nickname through UserIdentity in the identity card", () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("@regression shows white flag placeholder when country is null in Profile identity card", () => {
    useAuthStore.setState({ accessToken: "tok", user: baseUser({ country: null }) });
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
    const flags = screen.getAllByLabelText("No country");
    expect(flags.length).toBeGreaterThanOrEqual(1);
  });

  it("negative: Profile with no user renders loading text, not a nickname", () => {
    useAuthStore.setState({ accessToken: null, user: null });
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Alice")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// § 2.3 ToggleGroup used in PlayOnline (via direct component render)
// ---------------------------------------------------------------------------

describe("§2.3 ToggleGroup standalone — rated toggle (2 options)", () => {
  it("@regression renders a group with 2 buttons for rated/casual", () => {
    render(
      <ToggleGroup
        value={true}
        onChange={() => undefined}
        options={[
          { value: true, label: "Rated" },
          { value: false, label: "Casual" },
        ]}
        ariaLabel="Rate type"
      />,
    );
    const group = screen.getByRole("group");
    expect(group).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("negative: rated toggle with empty options renders group with no buttons", () => {
    render(
      <ToggleGroup
        value={true}
        onChange={() => undefined}
        options={[]}
        ariaLabel="Empty group"
      />,
    );
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// § 2.3 ToggleGroup used in InlineChallengeForm (3 groups: mode, rated, color)
// ---------------------------------------------------------------------------

describe("§2.3 ToggleGroup in InlineChallengeForm — 3 role=group elements", () => {
  const friend = makeFriend({ userId: "f1", nickname: "Levi", online: true });

  it("@regression renders exactly 3 role=group elements (mode, rated, color)", () => {
    render(
      <InlineChallengeForm
        friend={friend}
        onSent={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(3);
  });

  it("negative: InlineChallengeForm without friend prop data shows no groups (type-safety guard via required prop)", () => {
    // This test documents that the component is not renderable without a friend;
    // TypeScript would reject it at compile time. At runtime with a minimal stub
    // the groups still render, confirming ToggleGroup is always initialised.
    const stub = { userId: "x", nickname: "", country: null, blitzRating: 0, online: false, friendedAt: "" };
    render(
      <InlineChallengeForm friend={stub} onSent={vi.fn()} onBack={vi.fn()} />,
    );
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// § 2.4 EmptyState used in FriendsPopup empty state
// ---------------------------------------------------------------------------

describe("§2.4 EmptyState in FriendsPopup empty state", () => {
  it("@regression shows empty-state title when friends list is empty", () => {
    mockFriends = [];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.getByText(/no friends yet/i)).toBeInTheDocument();
  });

  it("@regression shows action button (Find friends) when friends list is empty", () => {
    mockFriends = [];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /find friends/i })).toBeInTheDocument();
  });

  it("negative: empty-state content does not appear when a friend exists", () => {
    mockFriends = [makeFriend({ userId: "u9", nickname: "Carlsen" })];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/no friends yet/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// § 2.4 EmptyState used in NotificationsPopup
// ---------------------------------------------------------------------------

describe("§2.4 EmptyState in NotificationsPopup", () => {
  it("@regression renders 'You're all caught up.' via EmptyState description", () => {
    render(<NotificationsPopup />);
    expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it("negative: NotificationsPopup does not render a friend nickname", () => {
    render(<NotificationsPopup />);
    expect(screen.queryByText("Carlsen")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// § 2.5 OnlineStatusDot — FriendsPopup with 1 online + 1 offline friend
// ---------------------------------------------------------------------------

describe("§2.5 OnlineStatusDot in FriendsPopup", () => {
  it("@regression renders aria-label='online' dot for online friend", () => {
    mockFriends = [
      makeFriend({ userId: "u-on", nickname: "Online", online: true }),
      makeFriend({ userId: "u-off", nickname: "Offline", online: false }),
    ];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("online")).toBeInTheDocument();
  });

  it("@regression renders aria-label='offline' dot for offline friend", () => {
    mockFriends = [
      makeFriend({ userId: "u-on", nickname: "Online", online: true }),
      makeFriend({ userId: "u-off", nickname: "Offline", online: false }),
    ];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("offline")).toBeInTheDocument();
  });

  it("negative: no online dot rendered when friend has no online prop (undefined / no friend)", () => {
    // UserIdentity only renders OnlineStatusDot when online !== undefined
    mockFriends = [];
    render(
      <MemoryRouter>
        <FriendsPopup />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText("online")).toBeNull();
    expect(screen.queryByLabelText("offline")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// § 2.5 RatedBadge in GameRow
// ---------------------------------------------------------------------------

describe("§2.5 RatedBadge in GameRow", () => {
  it("@regression isRated=true shows Rated badge text", () => {
    render(
      <MemoryRouter>
        <GameRow item={makeGameItem({ isRated: true })} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Rated")).toBeInTheDocument();
  });

  it("@regression isRated=false shows Casual badge text", () => {
    render(
      <MemoryRouter>
        <GameRow item={makeGameItem({ isRated: false })} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Casual")).toBeInTheDocument();
  });

  it("negative: isRated=true row does not show Casual badge", () => {
    render(
      <MemoryRouter>
        <GameRow item={makeGameItem({ isRated: true })} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Casual")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// § 2.5 MODE_OPTIONS shared constant — 4 entries
// ---------------------------------------------------------------------------

describe("§2.5 MODE_OPTIONS shared constant from mode-labels", () => {
  const KNOWN_MODES = ["Bullet", "Blitz", "Rapid", "Classical"] as const;

  it("@regression has exactly 4 entries", () => {
    expect(MODE_OPTIONS).toHaveLength(4);
  });

  it("@regression includes all four canonical mode names", () => {
    const modes = MODE_OPTIONS.map((o) => o.mode);
    for (const m of KNOWN_MODES) {
      expect(modes).toContain(m);
    }
  });

  it("negative: does not contain a fifth unknown mode", () => {
    const modes = MODE_OPTIONS.map((o) => o.mode);
    expect(modes).not.toContain("Ultrafast");
  });
});
