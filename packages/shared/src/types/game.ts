export type GameColor = "white" | "black";
export type GameResult = "white_win" | "black_win" | "draw";

export const GameEndReason = {
  Checkmate: "checkmate",
  Resignation: "resignation",
  Flag: "flag",
  FlagVsInsufficientMaterial: "flag_vs_insufficient_material",
  Stalemate: "stalemate",
  InsufficientMaterial: "insufficient_material",
  ThreefoldRepetition: "threefold_repetition",
  FiftyMove: "fifty_move",
  Agreement: "agreement",
} as const;
export type GameEndReason = (typeof GameEndReason)[keyof typeof GameEndReason];
