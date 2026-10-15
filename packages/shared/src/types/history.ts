import type { Mode } from "./user.js";
import type { GameEndReason, GameResult } from "./game.js";

export type GameHistoryResultFilter = "wins" | "losses" | "draws";

export interface GameListItem {
  gameId: string;
  mode: Mode;
  playerColor: "white" | "black";
  opponent: { nickname: string; ratingAfter: number };
  result: "win" | "loss" | "draw";
  endReason: GameEndReason;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
}

export interface GameListPagination {
  page: number;
  perPage: 20;
  totalGames: number;
  totalPages: number;
}

export interface GameListResponse {
  games: GameListItem[];
  pagination: GameListPagination;
}

export interface GameReplayResponse {
  gameId: string;
  mode: Mode;
  timeControlMs: number;
  pgn: string;
  finalFen: string;
  white: { userId: string; nickname: string; ratingBefore: number; ratingAfter: number };
  black: { userId: string; nickname: string; ratingBefore: number; ratingAfter: number };
  result: GameResult;
  endReason: GameEndReason;
  startedAt: string;
  endedAt: string;
}
