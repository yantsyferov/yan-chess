import { z } from 'zod';
import { MOVE_CATEGORIES } from '../types/analysis.js';

export const moveCategorySchema = z.enum(MOVE_CATEGORIES);

export const writeAnalysisMoveSchema = z.object({
  playerColor: z.enum(['white', 'black']),
  category: moveCategorySchema,
  evaluationCp: z.number().int().nullable(),
  mateIn: z.number().int().nullable(),
  bestMoveUci: z.string().min(4).max(5),
  classifierVersion: z.number().int().positive(),
  engineDepth: z.number().int().positive(),
});

export const finalizeAnalysisSchema = z.object({
  classifierVersion: z.number().int().positive(),
  engineDepth: z.number().int().positive(),
});
