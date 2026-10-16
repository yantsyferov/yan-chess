import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock i18n
vi.mock("../../../i18n", () => ({
  default: { changeLanguage: vi.fn().mockResolvedValue(undefined) },
}));

// Mock apiClient authedFetch to track PATCH calls
const authedFetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true, body: null });
vi.mock("../apiClient", () => ({
  authedFetch: authedFetchMock,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

// Mock online + friends sockets (pulled in by authService)
vi.mock("../../online/socket", () => ({ disconnectSocket: vi.fn() }));
vi.mock("../../friends/friends-socket", () => ({ disconnectFriendsSocket: vi.fn() }));
vi.mock("../../friends/useFriendsStore", () => ({ resetFriendsStore: vi.fn() }));

// We need a real fetch mock for fetchMe's direct fetch calls
const mockFetch = vi.fn();

describe("fetchMe → lang merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset module registry so stores start fresh
    vi.resetModules();
    globalThis.fetch = mockFetch;
  });

  it("when /users/me returns lang='ru', useLangStore.current becomes 'ru' and no PATCH is fired", async () => {
    // Set up fetch to return a user with lang='ru'
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        id: "abc",
        nickname: "Tester",
        email: "t@t.com",
        createdAt: new Date().toISOString(),
        avatar: null,
        lang: "ru",
        ratings: [],
      }),
      text: async () => "",
    } as unknown as Response);

    // Need to re-import after resetModules, also re-apply mock for apiClient
    vi.mock("../apiClient", () => ({
      authedFetch: authedFetchMock,
      apiGet: vi.fn(),
      apiPost: vi.fn(),
      apiDelete: vi.fn(),
    }));

    const { fetchMe } = await import("../authService");
    const { useLangStore } = await import("../../i18n/useLangStore");

    // Prime auth store with a token
    const { useAuthStore } = await import("../useAuthStore");
    useAuthStore.getState().setSession("tok", {
      id: "abc",
      nickname: "Tester",
      email: "t@t.com",
      createdAt: new Date().toISOString(),
      country: null,
    });

    await fetchMe();

    // lang should be 'ru'
    expect(useLangStore.getState().current).toBe("ru");

    // No PATCH should have been fired (skipPatch=true path)
    const patchCalls = authedFetchMock.mock.calls.filter(
      (args: unknown[]) => args[0] === "/users/me" && (args[1] as RequestInit).method === "PATCH",
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("when /users/me returns lang=null, useLangStore.current is unchanged", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        id: "abc",
        nickname: "Tester",
        email: "t@t.com",
        createdAt: new Date().toISOString(),
        avatar: null,
        lang: null,
        ratings: [],
      }),
      text: async () => "",
    } as unknown as Response);

    const { fetchMe } = await import("../authService");
    const { useLangStore } = await import("../../i18n/useLangStore");

    const before = useLangStore.getState().current;

    const { useAuthStore } = await import("../useAuthStore");
    useAuthStore.getState().setSession("tok", {
      id: "abc",
      nickname: "Tester",
      email: "t@t.com",
      createdAt: new Date().toISOString(),
      country: null,
    });

    await fetchMe();

    expect(useLangStore.getState().current).toBe(before);
  });
});
