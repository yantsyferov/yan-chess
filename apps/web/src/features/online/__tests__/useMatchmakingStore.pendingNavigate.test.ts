// @layer: unit
// @spec: 010-frontend-reliability
// @regression

/**
 * Integration-ish wiring tests: verify that useMatchmakingStore.joinQueue /
 * leaveQueue correctly set / clear useOnlineGameStore.pendingNavigate.
 * We use real Zustand stores (no mocks for store internals) to catch wiring
 * regressions. The Socket.IO connection is mocked so no network is involved.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock socket so joinQueue / leaveQueue don't attempt a real websocket connection.
// ---------------------------------------------------------------------------
const mockSocketEmit = vi.fn();
const mockSocket = {
  emit: mockSocketEmit,
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock("../socket", () => ({
  getSocket: () => mockSocket,
  disconnectSocket: vi.fn(),
  resetSocket: vi.fn(),
}));

import { useMatchmakingStore } from "../useMatchmakingStore";
import { useOnlineGameStore } from "../useOnlineGameStore";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset both stores to pristine initial state before each test.
  useOnlineGameStore.getState().reset();
  useMatchmakingStore.setState({ phase: "idle", mode: null, since: null });
});

describe("useMatchmakingStore – pendingNavigate wiring", () => {
  // @regression
  it("joinQueue sets useOnlineGameStore.pendingNavigate to true", () => {
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
    useMatchmakingStore.getState().joinQueue("Blitz");
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
  });

  // @regression
  it("leaveQueue clears useOnlineGameStore.pendingNavigate to false", () => {
    useMatchmakingStore.getState().joinQueue("Blitz");
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
    useMatchmakingStore.getState().leaveQueue();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  it("negative: joinQueue without prior state still leaves pendingNavigate true", () => {
    // sanity: starts false
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
    useMatchmakingStore.getState().joinQueue("Rapid");
    // must be true — even when called without prior leaveQueue
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
  });

  it("negative: leaveQueue without prior joinQueue does NOT set pendingNavigate to true", () => {
    // If called while flag is already false, it must stay false (not toggle)
    useMatchmakingStore.getState().leaveQueue();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  it("joinQueue emits queue.join socket event with the correct mode", () => {
    useMatchmakingStore.getState().joinQueue("Blitz");
    expect(mockSocketEmit).toHaveBeenCalledWith("queue.join", { mode: "Blitz" });
  });

  it("leaveQueue emits queue.leave socket event", () => {
    useMatchmakingStore.getState().leaveQueue();
    expect(mockSocketEmit).toHaveBeenCalledWith("queue.leave", {});
  });
});
