export const MOVE_CATEGORIES = [
  'Brilliant',
  'Great',
  'Best',
  'Excellent',
  'Good',
  'Book',
  'Forced',
  'Inaccuracy',
  'Mistake',
  'Blunder',
  'Miss',
] as const;

export type MoveCategory = (typeof MOVE_CATEGORIES)[number];

export interface AnalysisMove {
  moveIndex: number;
  playerColor: 'white' | 'black';
  category: MoveCategory;
  evaluationCp: number | null;
  mateIn: number | null;
  bestMoveUci: string;
}

export interface AnalysisResponse {
  gameId: string;
  classifierVersion: number;
  engineDepth: number;
  completedAt: string | null; // ISO 8601
  moves: AnalysisMove[];
}

export interface WriteAnalysisMoveBody {
  playerColor: 'white' | 'black';
  category: MoveCategory;
  evaluationCp: number | null;
  mateIn: number | null;
  bestMoveUci: string;
  classifierVersion: number;
  engineDepth: number;
}

export interface FinalizeAnalysisBody {
  classifierVersion: number;
  engineDepth: number;
}
