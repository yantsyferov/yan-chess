// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, beforeEach } from "vitest";
import { useSessionAnalysisStore } from "../useSessionAnalysisStore";

beforeEach(() => {
  useSessionAnalysisStore.getState().clear();
});

describe("useSessionAnalysisStore", () => {
  it("starts with null payload", () => {
    expect(useSessionAnalysisStore.getState().payload).toBeNull();
  });

  it("set() stores the payload", () => {
    const payload = { pgn: "1. e4 e5", playerColor: "white" as const, source: "vs-bot" as const };
    useSessionAnalysisStore.getState().set(payload);
    expect(useSessionAnalysisStore.getState().payload).toEqual(payload);
  });

  it("clear() resets payload to null", () => {
    useSessionAnalysisStore.getState().set({ pgn: "1. e4 e5", playerColor: "black" as const, source: "hotseat" as const });
    useSessionAnalysisStore.getState().clear();
    expect(useSessionAnalysisStore.getState().payload).toBeNull();
  });
});
