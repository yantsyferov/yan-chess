import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "../auth/apiClient";
import type { GameListResponse, GameListItem, GameListPagination } from "@yanchess/shared";

interface GamesListState {
  games: GameListItem[];
  pagination: GameListPagination | null;
  loading: boolean;
  error: string | null;
}

interface UseGamesListResult {
  games: GameListItem[];
  pagination: GameListPagination | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGamesList(): UseGamesListResult {
  const [searchParams] = useSearchParams();
  const pageParam = searchParams.get("page");
  const page = pageParam !== null ? Number(pageParam) : 1;
  const mode = searchParams.get("mode");
  const result = searchParams.get("result");

  const [state, setState] = useState<GamesListState>({
    games: [],
    pagination: null,
    loading: true,
    error: null,
  });

  const [fetchCount, setFetchCount] = useState(0);

  const refetch = useCallback((): void => {
    setFetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const qs = new URLSearchParams({ page: String(page) });
    if (mode !== null) qs.set("mode", mode);
    if (result !== null) qs.set("result", result);

    void apiGet<GameListResponse>(`/users/me/games?${qs.toString()}`).then((res) => {
      if (cancelled) return;

      if (!res.ok) {
        setState({ games: [], pagination: null, loading: false, error: "Failed to load game history." });
        return;
      }

      setState({
        games: res.body.games,
        pagination: res.body.pagination,
        loading: false,
        error: null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [page, mode, result, fetchCount]);

  return { games: state.games, pagination: state.pagination, loading: state.loading, error: state.error, refetch };
}
