import { z } from "zod";
import { SUPPORTED_LANGS } from "../types/lang.js";

export const updateMeSchema = z.object({
  lang: z.enum(SUPPORTED_LANGS).optional(),
  country: z.string().length(2).nullable().optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
