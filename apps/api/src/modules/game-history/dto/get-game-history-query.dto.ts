import { z } from "zod";

export const getGameHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  mode: z.enum(["Bullet", "Blitz", "Rapid", "Classical"]).optional(),
  result: z.enum(["wins", "losses", "draws"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type GetGameHistoryQuery = z.infer<typeof getGameHistoryQuerySchema>;
