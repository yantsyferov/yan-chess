import { z } from "zod";
import { SUPPORTED_LANGS } from "../types/lang.js";

// Primitive field schemas — reused across request schemas.
export const emailSchema = z
  .string({ required_error: "email.required" })
  .trim()
  .toLowerCase()
  .min(1, { message: "email.required", params: { i18nKey: "email.required" } } as never)
  .email({ message: "email.invalid", params: { i18nKey: "email.invalid" } } as never);

export const nicknameSchema = z
  .string({ required_error: "nickname.required" })
  .min(3, { message: "nickname.too_short", params: { i18nKey: "nickname.too_short" } } as never)
  .max(20, { message: "nickname.too_long", params: { i18nKey: "nickname.too_long" } } as never)
  .regex(/^[A-Za-z0-9_]+$/, { message: "nickname.invalid_chars", params: { i18nKey: "nickname.invalid_chars" } } as never);

export const passwordSchema = z
  .string({ required_error: "password.required" })
  .min(8, { message: "password.too_short", params: { i18nKey: "password.too_short" } } as never)
  .regex(/[A-Za-z]/, { message: "password.needs_letter", params: { i18nKey: "password.needs_letter" } } as never)
  .regex(/\d/, { message: "password.needs_digit", params: { i18nKey: "password.needs_digit" } } as never);

// Request schemas.
export const registerSchema = z
  .object({
    email: emailSchema,
    nickname: nicknameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    lang: z.enum(SUPPORTED_LANGS).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "password.confirmation_mismatch",
    params: { i18nKey: "password.confirmation_mismatch" },
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "password.required", params: { i18nKey: "password.required" } } as never),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: "token.required", params: { i18nKey: "token.required" } } as never),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "password.confirmation_mismatch",
    params: { i18nKey: "password.confirmation_mismatch" },
    path: ["confirmNewPassword"],
  });

// Inferred types.
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
