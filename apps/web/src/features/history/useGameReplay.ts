import { useState, useCallback, useEffect } from "react";
import { Chess } from "chess.js";
import type { GameReplayResponse } from "@yanchess/shared";
import { apiGet } from "../auth/apiClient";
import { useAuthStore } from "../auth/useAuthStore";

export interface VerboseMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
}

export interface ReplayData {
  gameId: string;
  mode: GameReplayResponse["mode"];
  timeControlMs: number;
  pgn: string;
  finalFen: string;
  white: GameReplayResponse["white"];
  black: GameReplayResponse["black"];
  result: GameReplayResponse["result"];
  endReason: GameReplayResponse["endReason"];
  startedAt: string;
  endedAt: string;
  // computed
  verboseMoves: VerboseMove[];
  movesSan: string[];
  myColor: "white" | "black";
}

export interface UseGameReplayResult {
  loading: boolean;
  error: null | "forbidden" | "network";
  data: null | ReplayData;
  refetch(): void;
}

export function useGameReplay(gameId: string): UseGameReplayResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | "forbidden" | "network">(null);
  const [data, setData] = useState<null | ReplayData>(null);
  const [fetchCount, setFetchCount] = useState(0);

  const refetch = useCallback((): void => {
    setFetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setData(null);

    void (async () => {
      try {
        const res = await apiGet<GameReplayResponse>(`/games/${gameId}`);
        if (cancelled) return;

        if (res.status === 200) {
          const raw = res.body;
          const chess = new Chess();
          chess.loadPgn(raw.pgn);
          const history = chess.history({ verbose: true });
          const verboseMoves: VerboseMove[] = history.map((m) => ({
            from: m.from,
            to: m.to,
            promotion: m.promotion,
            san: m.san,
          }));
          const movesSan = verboseMoves.map((m) => m.san);

          const userId = useAuthStore.getState().user?.id;
          const myColor: "white" | "black" =
            userId === raw.black.userId ? "black" : "white";

          if (!cancelled) {
            setData({
              gameId: raw.gameId,
              mode: raw.mode,
              timeControlMs: raw.timeControlMs,
              pgn: raw.pgn,
              finalFen: raw.finalFen,
              white: raw.white,
              black: raw.black,
              result: raw.result,
              endReason: raw.endReason,
              startedAt: raw.startedAt,
              endedAt: raw.endedAt,
              verboseMoves,
              movesSan,
              myColor,
            });
          }
        } else if (res.status === 403 || res.status === 404) {
          // 403 (not a participant) and 404 (unknown id) share the same body
          // { error: { code: "GAME_NOT_AVAILABLE" } } — functional-spec §2.7 maps
          // both to the "Game not available" UI card (no enumeration disclosure).
          if (!cancelled) setError("forbidden");
        } else {
          if (!cancelled) setError("network");
        }
      } catch {
        if (!cancelled) setError("network");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, fetchCount]);

  return { loading, error, data, refetch };
}
