// @layer: unit
// @spec: 010-frontend-reliability
// @regression

import { describe, it, expect, beforeEach } from "vitest";
import { useOnlineGameStore } from "../useOnlineGameStore";

// Reset store to initial state before each test so tests are isolated.
beforeEach(() => {
  useOnlineGameStore.getState().reset();
});

describe("useOnlineGameStore – pendingNavigate guard flag", () => {
  // @regression
  it("default state has pendingNavigate: false", () => {
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  // @regression
  it("markPendingNavigate() sets pendingNavigate to true", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
  });

  // @regression
  it("clearPendingNavigate() sets pendingNavigate back to false", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    useOnlineGameStore.getState().clearPendingNavigate();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  it("negative: clearPendingNavigate() on already-false flag stays false (idempotent)", () => {
    // Calling clear when already false must not throw or flip to something else
    useOnlineGameStore.getState().clearPendingNavigate();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });

  it("negative: markPendingNavigate() called twice still yields true (idempotent)", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    useOnlineGameStore.getState().markPendingNavigate();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(true);
  });

  it("reset() brings pendingNavigate back to false even when marked", () => {
    useOnlineGameStore.getState().markPendingNavigate();
    useOnlineGameStore.getState().reset();
    expect(useOnlineGameStore.getState().pendingNavigate).toBe(false);
  });
});
