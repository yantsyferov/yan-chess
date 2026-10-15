import type { ZodErrorMap } from "zod";
import i18n from "i18next";

const I18N_KEY_PATTERN = /^[a-z_]+\.[a-z_]+$/;

/**
 * Custom Zod error map that translates i18nKey-shaped messages.
 * Only consulted by Zod for issues that have NO custom message override.
 * For schemas that set explicit message strings, use translateZodMessage instead.
 */
export const zodErrorMap: ZodErrorMap = (issue, ctx) => {
  const params = (issue as { params?: { i18nKey?: string } }).params;
  const key = params?.i18nKey ?? (I18N_KEY_PATTERN.test(issue.message ?? "") ? issue.message : undefined);
  if (key) {
    return { message: i18n.t(`errors:${key}`) };
  }
  return { message: ctx.defaultError };
};

/**
 * Translates a single message string if it matches an i18nKey pattern.
 * Use this to post-process react-hook-form field error messages.
 */
export function translateZodMessage(message: string | undefined): string | undefined {
  if (!message) return message;
  if (I18N_KEY_PATTERN.test(message)) {
    return i18n.t(`errors:${message}`);
  }
  return message;
}
