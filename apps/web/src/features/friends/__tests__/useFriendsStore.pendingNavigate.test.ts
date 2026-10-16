// @layer: unit
// @spec: 010-frontend-reliability
// @regression

/**
 * Wiring tests: verify that useFriendsStore correctly calls
 * markPendingNavigate / clearPendingNavigate on useOnlineGameStore when:
 *   - sendChallenge(mode, color) is called
 *   - respondInboundChallenge(true) is called
 *   - respondInboundChallenge(false) is called
 *   - cancelOutboundChallenge() is called
 *   - socket events challenge.declined / challenge.expired / challenge.cancelled fire
 *
 * Real Zustand stores are used; socket and API are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock API calls so wire() doesn't hit the network.
// ---------------------------------------------------------------------------
vi.mock("../../auth/apiClient", () => ({
  apiGet: vi.fn().mockResolvedValue({ ok: true, status: 200, body: { friends: [], requests: [] } }),
  apiPost: vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} }),
  apiDelete: vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} }),
}));

// ---------------------------------------------------------------------------
// Mock friends socket — capture event listeners so we can trigger them.
// ---------------------------------------------------------------------------
const friendsSocketListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockFriendsSocket = {
  emit: vi.fn(),
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (!friendsSocketListeners[event]) friendsSocketListeners[event] = [];
    friendsSocketListeners[event]!.push(cb);
  }),
  off: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock("../friends-socket", () => ({
  getFriendsSocket: () => mockFriendsSocket,
  disconnectFriendsSocket: vi.fn(),
  resetFriendsSocket: vi.fn(),
}));

// Helper to fire a captured socket event.
function fireSocketEvent(event: string, payload: unknown): void {
  const listeners = friendsSocketListeners[event] ?? [];
  for (const listener of listeners) {
    listener(payload);
  }
}

// Re-import after mocks are set up.
import { useFriendsStore, resetFriendsStore } from "../useFriendsStore";
import { useOnlineGameStore } from "../../online/useOnlineGameStore";

// ---------------------------------------------------------------------------
// Shared outbound challenge fixture (must exist for sendChallenge to proceed).
// ---------------------------------------------------------------------------
const OUTBOUND_FIXTURE = {
  targetUserId: "user-bob",
  targetNickname: "bob",
  mode: "Blitz" as const,
  color: "white" as const,
  isRated: true,
  challengeId: "ch-001",
  sentAt: Date.now(),
  expiresAt: Date.now() + 30_000,
};

const INBOUND_FIXTURE = {
  challengeId: "ch-in-001",
  challengerUserId: "user-alice",
  challengerNickname: "alice",
  mode: "Blitz" as const,
  color: "white" as const,
  isRated: true,
  expiresAt: Date.now() + 30_000,
};

beforeEach(async () => {
  vi.clearAllMocks();

  // Reset both stores.
  useOnlineGameStore.getState().reset();
  resetFriendsStore(); // clears the module-level _wired flag so wire() runs again

  // Clear captured listeners.
  for (const key of Object.keys(friendsSocketListeners)) {
    delete friendsSocketListeners[key];
  }

  // Wire the store so socket listeners are attached.
  await useFriendsStore.getState().wire();
});

// ---------------------------------------------------------------------------

describe("useFriendsStore – pendingNavigate wiring", () => {
  // @regression
  it("sendChallenge() sets pendingNavigate to true", () => {
    // Precondition: an open outbound challenge exists in the store.
    useFriendsStore.setState({ outboundChallenge: { ...OUTBOUND_FIXTURE, challengeId: null, sentAt: 0, expiresAt: 0 } });

    useFriendsStore.getState().sendChallenge("Blitz", "white", true);

    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
  });

  // @regression
  it("respondInboundChallenge(true) sets pendingNavigate to true", () => {
    useFriendsStore.setState({ inboundChallenge: { ...INBOUND_FIXTURE } });

    useFriendsStore.getState().respondInboundChallenge(true);

    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
  });

  // @regression
  it("respondInboundChallenge(false) does NOT set pendingNavigate to true", () => {
    useFriendsStore.setState({ inboundChallenge: { ...INBOUND_FIXTURE } });

    useFriendsStore.getState().respondInboundChallenge(false);

    // Flag must remain false — declining a challenge is not an opt-in.
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  // @regression
  it("cancelOutboundChallenge() clears pendingNavigate to false", () => {
    // Set up: mark as pending first (simulate prior sendChallenge opt-in).
    useOnlineGameStore.getState().markPendingNavigate();
    useFriendsStore.setState({ outboundChallenge: { ...OUTBOUND_FIXTURE } });

    useFriendsStore.getState().cancelOutboundChallenge();

    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  // @regression
  it("socket event challenge.declined clears pendingNavigate", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    useFriendsStore.setState({ outboundChallenge: { ...OUTBOUND_FIXTURE } });

    fireSocketEvent("challenge.declined", { challengeId: OUTBOUND_FIXTURE.challengeId });

    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  // @regression
  it("socket event challenge.expired clears pendingNavigate", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    useFriendsStore.setState({ outboundChallenge: { ...OUTBOUND_FIXTURE } });

    fireSocketEvent("challenge.expired", { challengeId: OUTBOUND_FIXTURE.challengeId });

    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  // @regression
  it("socket event challenge.cancelled clears pendingNavigate", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    useFriendsStore.setState({ outboundChallenge: { ...OUTBOUND_FIXTURE } });

    fireSocketEvent("challenge.cancelled", { challengeId: OUTBOUND_FIXTURE.challengeId });

    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  it("negative: sendChallenge() is a no-op (no mark) when outboundChallenge is null", () => {
    useFriendsStore.setState({ outboundChallenge: null });
    useFriendsStore.getState().sendChallenge("Blitz", "white", true);
    // pendingNavigate must not have been set.
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  it("negative: respondInboundChallenge(true) is a no-op when inboundChallenge is null", () => {
    useFriendsStore.setState({ inboundChallenge: null });
    useFriendsStore.getState().respondInboundChallenge(true);
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });
});
