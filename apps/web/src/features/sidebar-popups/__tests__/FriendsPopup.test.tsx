// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n/index";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import type { FriendListItem } from "@yanchess/shared";

function makeFriend(overrides: Partial<FriendListItem> & { userId: string; nickname: string }): FriendListItem {
  return {
    country: null,
    blitzRating: 1500,
    online: false,
    friendedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Mutable so each test can inject its own friends list.
let mockFriends: FriendListItem[] = [];

vi.mock("../../friends/useFriendsStore", () => ({
  useFriendsStore: (selector: (s: { friends: FriendListItem[] }) => unknown) =>
    selector({ friends: mockFriends }),
}));

import { FriendsPopup } from "../FriendsPopup";

function renderPopup() {
  return render(
    <MemoryRouter>
      <FriendsPopup />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFriends = [];
});

describe("FriendsPopup", () => {
  describe("list rendering", () => {
    it("renders both friend rows when 2 friends are present", () => {
      mockFriends = [
        makeFriend({ userId: "u1", nickname: "Alice" }),
        makeFriend({ userId: "u2", nickname: "Bob" }),
      ];
      renderPopup();
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("Bob")).toBeTruthy();
    });
  });

  describe("10-row cap", () => {
    it("renders at most 10 rows when 15 friends are present", () => {
      mockFriends = Array.from({ length: 15 }, (_, i) =>
        makeFriend({ userId: `u${i}`, nickname: `Player${i}` }),
      );
      renderPopup();
      // First 10 players should be visible
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Player${i}`)).toBeTruthy();
      }
      // 11th through 15th should NOT be rendered
      for (let i = 10; i < 15; i++) {
        expect(screen.queryByText(`Player${i}`)).toBeNull();
      }
    });

    it("shows 'Open full Friends page' link when 15 friends present", () => {
      mockFriends = Array.from({ length: 15 }, (_, i) =>
        makeFriend({ userId: `u${i}`, nickname: `Player${i}` }),
      );
      renderPopup();
      expect(screen.getByText("Open full Friends page")).toBeTruthy();
    });
  });

  describe("empty state", () => {
    it("shows 'No friends yet' text when friends list is empty", () => {
      mockFriends = [];
      renderPopup();
      expect(screen.getByText("No friends yet")).toBeTruthy();
    });

    it("shows 'Find friends' button when friends list is empty", () => {
      mockFriends = [];
      renderPopup();
      expect(screen.getByRole("button", { name: /find friends/i })).toBeTruthy();
    });

    it("'Find friends' button is wrapped in a link to /friends", () => {
      mockFriends = [];
      renderPopup();
      const link = screen.getByRole("link", { name: /find friends/i });
      expect(link).toHaveAttribute("href", "/friends");
    });
  });

  describe("header count", () => {
    it("shows 'Friends (5)' in header when 5 friends present", () => {
      mockFriends = Array.from({ length: 5 }, (_, i) =>
        makeFriend({ userId: `u${i}`, nickname: `Player${i}` }),
      );
      renderPopup();
      expect(screen.getByText("Friends (5)")).toBeTruthy();
    });
  });

  describe("open full page link", () => {
    it("navigates to /friends when 'Open full Friends page' is clicked", async () => {
      mockFriends = [makeFriend({ userId: "u1", nickname: "Alice" })];
      renderPopup();
      const user = userEvent.setup();
      await user.click(screen.getByText("Open full Friends page"));
      expect(mockNavigate).toHaveBeenCalledWith("/friends");
    });
  });
});
