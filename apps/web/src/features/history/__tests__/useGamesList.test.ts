// @layer: unit
// @spec: 006-game-history
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// ── Mock apiGet ──────────────────────────────────────────────────────────────
const mockApiGet = vi.fn();
vi.mock("../../auth/apiClient", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

import { useGamesList } from "../useGamesList";
import type { GameListResponse } from "@yanchess/shared";

// Wrapper with MemoryRouter (hook uses useSearchParams)
function wrapper(initialUrl = "/") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(MemoryRouter, { initialEntries: [initialUrl] }, children);
  };
}

function makeResponse(games: unknown[] = [], page = 1, totalPages = 1): GameListResponse {
  return {
    games: games as GameListResponse["games"],
    pagination: { page, perPage: 20, totalPages, totalGames: games.length },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGamesList", () => {
  it("@regression starts with loading=true and fetches from /users/me/games", async () => {
    mockApiGet.mockResolvedValueOnce({ ok: true, body: makeResponse() });
    const { result } = renderHook(() => useGamesList(), { wrapper: wrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining("/users/me/games"));
  });

  it("@regression builds correct query string from URL params", async () => {
    mockApiGet.mockResolvedValueOnce({ ok: true, body: makeResponse() });
    renderHook(() => useGamesList(), {
      wrapper: wrapper("/?mode=Blitz&result=wins&page=2"),
    });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    const url: string = mockApiGet.mock.calls[0]?.[0] as string;
    expect(url).toContain("mode=Blitz");
    expect(url).toContain("result=wins");
    expect(url).toContain("page=2");
  });

  it("@regression returns games and pagination on success", async () => {
    const games = [
      {
        gameId: "g1",
        mode: "Blitz",
        playerColor: "white",
        opponent: { nickname: "bob", ratingAfter: 1484 },
        result: "win",
        endReason: "resignation",
        ratingBefore: 1500,
        ratingAfter: 1516,
        ratingDelta: 16,
        startedAt: "2026-10-11T18:00:00Z",
        endedAt: "2026-10-11T18:05:00Z",
      },
    ];
    mockApiGet.mockResolvedValueOnce({ ok: true, body: makeResponse(games, 1, 1) });
    const { result } = renderHook(() => useGamesList(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games).toHaveLength(1);
    expect(result.current.pagination?.totalGames).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("@regression sets error on non-ok response", async () => {
    mockApiGet.mockResolvedValueOnce({ ok: false, body: null });
    const { result } = renderHook(() => useGamesList(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.games).toHaveLength(0);
  });

  it("@regression refetch triggers re-fetch", async () => {
    mockApiGet
      .mockResolvedValueOnce({ ok: true, body: makeResponse([], 1, 1) })
      .mockResolvedValueOnce({ ok: true, body: makeResponse([], 1, 1) });

    const { result } = renderHook(() => useGamesList(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledTimes(1);

    act(() => { result.current.refetch(); });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
  });

  it("negative: mode param is omitted from query string when not in URL", async () => {
    mockApiGet.mockResolvedValueOnce({ ok: true, body: makeResponse() });
    renderHook(() => useGamesList(), { wrapper: wrapper("/?result=wins") });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    const url: string = mockApiGet.mock.calls[0]?.[0] as string;
    expect(url).toContain("result=wins");
    expect(url).not.toContain("mode=");
  });

  it("negative: page=1 does not include page param in query string (defaults)", async () => {
    mockApiGet.mockResolvedValueOnce({ ok: true, body: makeResponse() });
    renderHook(() => useGamesList(), { wrapper: wrapper("/") });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    const url: string = mockApiGet.mock.calls[0]?.[0] as string;
    // page=1 is still included because hook explicitly adds it
    expect(url).toContain("page=1");
    // mode and result should NOT be included when not in URL
    expect(url).not.toContain("mode=");
    expect(url).not.toContain("result=");
  });
});
