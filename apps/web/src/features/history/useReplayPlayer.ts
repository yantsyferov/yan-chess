import { useState, useCallback, useMemo, useEffect } from "react";
import { Chess } from "chess.js";
import type { VerboseMove } from "./useGameReplay";

export interface ReplayPlayerState {
  currentIndex: number;
  totalMoves: number;
  isPlaying: boolean;
  speed: number;
  fen: string;
  lastMove: { from: string; to: string } | null;
  sideToMove: "white" | "black";
  first: () => void;
  prev: () => void;
  next: () => void;
  last: () => void;
  jumpTo: (index: number) => void;
  togglePlay: () => void;
  setSpeed: (ms: number) => void;
}

export function useReplayPlayer(verboseMoves: VerboseMove[]): ReplayPlayerState {
  const totalMoves = verboseMoves.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(2000);

  const fen = useMemo((): string => {
    const chess = new Chess();
    for (let i = 0; i < currentIndex; i++) {
      chess.move(verboseMoves[i]);
    }
    return chess.fen();
  }, [currentIndex, verboseMoves]);

  const lastMove = useMemo((): { from: string; to: string } | null => {
    if (currentIndex === 0) return null;
    const m = verboseMoves[currentIndex - 1];
    if (m === undefined) return null;
    return { from: m.from, to: m.to };
  }, [currentIndex, verboseMoves]);

  const sideToMove = useMemo((): "white" | "black" => {
    // Second field of FEN is "w" or "b"
    const fenParts = fen.split(" ");
    return fenParts[1] === "b" ? "black" : "white";
  }, [fen]);

  const first = useCallback((): void => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  const prev = useCallback((): void => {
    setIsPlaying(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const next = useCallback((): void => {
    setIsPlaying(false);
    setCurrentIndex((i) => Math.min(totalMoves, i + 1));
  }, [totalMoves]);

  const last = useCallback((): void => {
    setIsPlaying(false);
    setCurrentIndex(totalMoves);
  }, [totalMoves]);

  const jumpTo = useCallback(
    (index: number): void => {
      setIsPlaying(false);
      setCurrentIndex(Math.max(0, Math.min(totalMoves, index)));
    },
    [totalMoves],
  );

  const togglePlay = useCallback((): void => {
    setIsPlaying((playing) => {
      if (!playing) {
        // If at end, reset to beginning before starting
        setCurrentIndex((i) => {
          if (i >= totalMoves) return 0;
          return i;
        });
      }
      return !playing;
    });
  }, [totalMoves]);

  const setSpeed = useCallback((ms: number): void => {
    setSpeedState(ms);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= totalMoves) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [isPlaying, speed, totalMoves]);

  return {
    currentIndex,
    totalMoves,
    isPlaying,
    speed,
    fen,
    lastMove,
    sideToMove,
    first,
    prev,
    next,
    last,
    jumpTo,
    togglePlay,
    setSpeed,
  };
}
