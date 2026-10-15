import type { Mode } from "@yanchess/shared";
import type { Winner } from "../game/useGameStore";
import type { GameEndReason as HotseatGameEndReason } from "../game/useGameStore";
import type { GameEndReason as OnlineGameEndReason } from "@yanchess/shared";

export type AnyGameEndReason = HotseatGameEndReason | OnlineGameEndReason;

export type { Mode };

export type Square = string; // e.g. "e2"
export interface MoveInput { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }
export interface PendingPromotion { from: Square; to: Square }
export interface GameClocks { whiteMs: number; blackMs: number }

export type GameColor = "white" | "black";

export interface GameViewModel {
  // state
  mode: Mode;
  fen: string;
  movesSan: string[];
  clocks: GameClocks;
  sideToMove: GameColor;
  boardOrientation: "white" | "black";
  canInteract: boolean;
  lastMove: { from: Square; to: Square } | null;
  pendingPromotion: PendingPromotion | null;
  pendingDrawOffer: { from: GameColor } | null;
  pendingResign: boolean;
  result: { winner: Winner; reason: AnyGameEndReason } | null;
  resultModalDismissed: boolean;

  // callbacks
  onSelectSquare: (sq: Square) => void;
  onMove: (move: MoveInput) => void;
  onPromote: (piece: "q" | "r" | "b" | "n") => void;
  onCancelPromotion: () => void;
  onResignClick: () => void;
  onResignConfirm: () => void;
  onResignCancel: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
  onDismissResult: () => void;
  onNewGame: () => void;
}
