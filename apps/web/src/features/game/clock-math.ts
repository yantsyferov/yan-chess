import { Chess } from "chess.js";

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100) / 10;
    return tenths.toFixed(1);
  }
  const totalSec = Math.ceil(clamped / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function isLowOnTime(ms: number): boolean {
  return ms < 10_000;
}

/**
 * FIDE Article 6.9: when a player's time elapses, the opponent wins — unless the opponent has
 * insufficient material to mate (bare king, king+bishop, king+knight). Returns true when the
 * opponent CAN still deliver mate given their current material.
 */
export function wouldOpponentHaveMatingMaterial(chess: Chess, flaggedSide: "white" | "black"): boolean {
  const opponentColor = flaggedSide === "white" ? "b" : "w";
  const board = chess.board();
  let bishopCount = 0;
  let knightCount = 0;
  let otherMaterial = false;
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue;
      if (sq.color !== opponentColor) continue;
      if (sq.type === "k") continue;
      if (sq.type === "b") bishopCount++;
      else if (sq.type === "n") knightCount++;
      else otherMaterial = true;
    }
  }
  if (otherMaterial) return true;
  if (bishopCount + knightCount >= 2) return true;
  return false;
}
