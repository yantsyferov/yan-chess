import { z } from "zod";
import { SUPPORTED_LANGS } from "../types/lang.js";

export const updateMeSchema = z.object({
  lang: z.enum(SUPPORTED_LANGS).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
