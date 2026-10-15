// @layer: unit
// @spec: 006-game-history
// @regression

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReplayPlayer } from "../useReplayPlayer";
import type { VerboseMove } from "../useGameReplay";

// ── Fake moves fixture ───────────────────────────────────────────────────────
// 10 half-moves: alternating e4, e5, Nf3, Nc6, …
const MOVES_10: VerboseMove[] = [
  { from: "e2", to: "e4", san: "e4" },
  { from: "e7", to: "e5", san: "e5" },
  { from: "g1", to: "f3", san: "Nf3" },
  { from: "b8", to: "c6", san: "Nc6" },
  { from: "f1", to: "b5", san: "Bb5" },
  { from: "a7", to: "a6", san: "a6" },
  { from: "b5", to: "a4", san: "Ba4" },
  { from: "g8", to: "f6", san: "Nf6" },
  { from: "e1", to: "g1", san: "O-O" },
  { from: "f8", to: "e7", san: "Be7" },
];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe("useReplayPlayer — navigation", () => {
  it("@regression initialises at index 0 with correct totalMoves", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.totalMoves).toBe(10);
    expect(result.current.isPlaying).toBe(false);
  });

  it("@regression next() advances index by 1", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.next(); });
    expect(result.current.currentIndex).toBe(1);
  });

  it("@regression next() does not exceed totalMoves", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.last(); });
    expect(result.current.currentIndex).toBe(10);
    act(() => { result.current.next(); });
    expect(result.current.currentIndex).toBe(10);
  });

  it("@regression prev() decrements index", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.next(); result.current.next(); });
    act(() => { result.current.prev(); });
    expect(result.current.currentIndex).toBe(1);
  });

  it("@regression prev() does not go below 0", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.prev(); });
    expect(result.current.currentIndex).toBe(0);
  });

  it("@regression first() jumps to 0", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.last(); });
    act(() => { result.current.first(); });
    expect(result.current.currentIndex).toBe(0);
  });

  it("@regression last() jumps to totalMoves", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.last(); });
    expect(result.current.currentIndex).toBe(10);
  });

  it("@regression jumpTo(5) sets index to 5", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.jumpTo(5); });
    expect(result.current.currentIndex).toBe(5);
  });

  it("@regression jumpTo clamps within [0, totalMoves]", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.jumpTo(-3); });
    expect(result.current.currentIndex).toBe(0);
    act(() => { result.current.jumpTo(999); });
    expect(result.current.currentIndex).toBe(10);
  });

  it("lastMove is null at index 0, then reflects previous move", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    expect(result.current.lastMove).toBeNull();
    act(() => { result.current.next(); });
    expect(result.current.lastMove).toEqual({ from: "e2", to: "e4" });
  });
});

// ── Autoplay ──────────────────────────────────────────────────────────────────

describe("useReplayPlayer — autoplay", () => {
  it("@regression togglePlay starts autoplay and advances index over time", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(true);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.currentIndex).toBe(1);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.currentIndex).toBe(2);
  });

  it("@regression autoplay stops automatically at final move and isPlaying returns false", async () => {
    // Jump to near end (2 moves remaining: 9, 10)
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.jumpTo(8); });
    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(true);

    // Advance enough time for all remaining moves + extra to let React flush
    // @regression — the guard inside setInterval must stop at totalMoves and set isPlaying false
    await act(async () => { vi.advanceTimersByTime(10000); }); // 5 intervals at 2s each

    // Index must NOT exceed totalMoves
    expect(result.current.currentIndex).toBe(10);
    // isPlaying must be false — the interval stopped autoplay at the end
    expect(result.current.isPlaying).toBe(false);
  });

  it("@regression togglePlay from end position resets to 0 then plays", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.last(); });
    expect(result.current.currentIndex).toBe(10);

    act(() => { result.current.togglePlay(); });
    // should reset to 0
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it("@regression manual action (prev) pauses autoplay", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(true);

    act(() => { result.current.prev(); });
    expect(result.current.isPlaying).toBe(false);
  });

  it("@regression manual action (next) pauses autoplay", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.togglePlay(); });
    act(() => { result.current.next(); });
    expect(result.current.isPlaying).toBe(false);
  });

  it("@regression manual action (jumpTo) pauses autoplay", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.togglePlay(); });
    act(() => { result.current.jumpTo(3); });
    expect(result.current.isPlaying).toBe(false);
  });

  it("@regression togglePlay pauses when already playing", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(true);
    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(false);
  });

  it("setSpeed changes the interval speed", () => {
    const { result } = renderHook(() => useReplayPlayer(MOVES_10));
    act(() => { result.current.setSpeed(1000); });
    act(() => { result.current.togglePlay(); });

    // At 1s/move, advancing 1000ms should move by 1
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.currentIndex).toBe(1);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("useReplayPlayer — edge cases", () => {
  it("empty moves array: FEN is starting position, totalMoves=0", () => {
    const { result } = renderHook(() => useReplayPlayer([]));
    expect(result.current.totalMoves).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    // FEN should be the starting position
    expect(result.current.fen).toContain("rnbqkbnr");
    expect(result.current.lastMove).toBeNull();
  });

  it("negative: no crash when autoplay runs on single-move game", async () => {
    const singleMove: VerboseMove[] = [{ from: "e2", to: "e4", san: "e4" }];
    const { result } = renderHook(() => useReplayPlayer(singleMove));
    act(() => { result.current.togglePlay(); });
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(result.current.currentIndex).toBe(1); // totalMoves=1, cannot exceed
    expect(result.current.isPlaying).toBe(false);
  });
});
