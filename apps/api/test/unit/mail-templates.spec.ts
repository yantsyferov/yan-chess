// @layer: unit
// @spec: 012-i18n
import { describe, it, expect, vi, beforeEach } from "vitest";

const warnMock = vi.hoisted(() => vi.fn());

vi.mock("@nestjs/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nestjs/common")>();
  return {
    ...actual,
    Logger: class {
      warn = warnMock;
      log = vi.fn();
      error = vi.fn();
    },
  };
});

import { verifyEmailTemplate } from "../../src/modules/mail/templates/verify-email.js";
import { resetPasswordTemplate } from "../../src/modules/mail/templates/reset-password.js";
import { resendVerifyTemplate } from "../../src/modules/mail/templates/resend-verify.js";
import type { Lang } from "@yanchess/shared";

const ctx = { link: "https://example.com/verify?token=abc", nickname: "Alice" };

describe("verifyEmailTemplate", () => {
  it("en: subject and html contain EN key phrase", () => {
    const { subject, html } = verifyEmailTemplate(ctx, "en");
    expect(subject).toContain("Verify your YanChess email");
    expect(html).toContain("Verify email");
  });

  it("ru: subject and html contain RU key phrase", () => {
    const { subject, html } = verifyEmailTemplate(ctx, "ru");
    expect(subject).toContain("Подтвердите вашу почту на YanChess");
    expect(html).toContain("Подтвердить");
  });

  it("es: subject and html contain ES key phrase", () => {
    const { subject, html } = verifyEmailTemplate(ctx, "es");
    expect(subject).toContain("Verifica tu correo en YanChess");
    expect(html).toContain("Verificar");
  });
});

describe("resetPasswordTemplate", () => {
  it("en: subject and html contain EN key phrase", () => {
    const { subject, html } = resetPasswordTemplate(ctx, "en");
    expect(subject).toContain("Reset your YanChess password");
    expect(html).toContain("Reset password");
  });

  it("ru: subject and html contain RU key phrase", () => {
    const { subject, html } = resetPasswordTemplate(ctx, "ru");
    expect(subject).toContain("Сброс пароля на YanChess");
    expect(html).toContain("Сбросить пароль");
  });

  it("es: subject and html contain ES key phrase", () => {
    const { subject, html } = resetPasswordTemplate(ctx, "es");
    expect(subject).toContain("Restablecer tu contraseña en YanChess");
    expect(html).toContain("Restablecer contraseña");
  });
});

describe("resendVerifyTemplate", () => {
  it("en: subject and html contain EN key phrase", () => {
    const { subject, html } = resendVerifyTemplate(ctx, "en");
    expect(subject).toContain("Verify your YanChess email");
    expect(html).toContain("Verify email");
  });

  it("ru: subject and html contain RU key phrase", () => {
    const { subject, html } = resendVerifyTemplate(ctx, "ru");
    expect(subject).toContain("Подтвердите вашу почту на YanChess");
    expect(html).toContain("Подтвердить");
  });

  it("es: subject and html contain ES key phrase", () => {
    const { subject, html } = resendVerifyTemplate(ctx, "es");
    expect(subject).toContain("Verifica tu correo en YanChess");
    expect(html).toContain("Verificar");
  });
});

describe("fallback to 'en' for unsupported lang", () => {
  beforeEach(() => {
    warnMock.mockClear();
  });

  it("verifyEmailTemplate falls back to en and warns", () => {
    const { subject, html } = verifyEmailTemplate(ctx, "fr" as Lang);
    expect(subject).toContain("Verify your YanChess email");
    expect(html).toContain("Verify email");
    expect(warnMock).toHaveBeenCalledOnce();
  });

  it("resetPasswordTemplate falls back to en and warns", () => {
    const { subject } = resetPasswordTemplate(ctx, "fr" as Lang);
    expect(subject).toContain("Reset your YanChess password");
    expect(warnMock).toHaveBeenCalledOnce();
  });

  it("resendVerifyTemplate falls back to en and warns", () => {
    const { subject } = resendVerifyTemplate(ctx, "fr" as Lang);
    expect(subject).toContain("Verify your YanChess email");
    expect(warnMock).toHaveBeenCalledOnce();
  });
});
