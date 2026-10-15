import { z } from "zod";

// Primitive field schemas — reused across request schemas.
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");
export const nicknameSchema = z.string().regex(/^[A-Za-z0-9_]{3,20}$/, "Nickname can contain 3–20 Latin letters, digits, and underscores");
export const passwordSchema = z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, "Password must be at least 8 characters and contain at least one letter and one digit");

// Request schemas.
export const registerSchema = z.object({
  email: emailSchema,
  nickname: nicknameSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

// Inferred types.
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
