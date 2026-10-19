import type {
  AnalysisResponse,
  WriteAnalysisMoveBody,
  FinalizeAnalysisBody,
} from "@yanchess/shared";
import { authedFetch } from "../auth/apiClient";

/**
 * Fetch the persisted analysis for a game.
 * Returns null on 404 (no analysis stored yet).
 * Throws on unexpected errors.
 */
export async function fetchAnalysis(gameId: string): Promise<AnalysisResponse | null> {
  const res = await authedFetch<AnalysisResponse>(`/games/${gameId}/analysis`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`fetchAnalysis failed: ${res.status}`);
  }
  return res.body;
}

/**
 * Idempotent per-move upsert during a deep pass.
 */
export async function writeMove(
  gameId: string,
  moveIndex: number,
  body: WriteAnalysisMoveBody
): Promise<void> {
  const res = await authedFetch(`/games/${gameId}/analysis/moves/${moveIndex}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`writeMove failed: ${res.status}`);
  }
}

/**
 * Stamp the analysis record as complete with metadata.
 */
export async function finalize(
  gameId: string,
  body: FinalizeAnalysisBody
): Promise<void> {
  const res = await authedFetch(`/games/${gameId}/analysis/finalize`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`finalize failed: ${res.status}`);
  }
}
