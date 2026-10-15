import { Logger } from "@nestjs/common";
import type { Lang } from "@yanchess/shared";

const logger = new Logger("verifyEmailTemplate");

type Ctx = { link: string; nickname?: string };

const translations: Record<Lang, { subject: string; html: (ctx: Ctx) => string }> = {
  en: {
    subject: "Verify your YanChess email",
    html: ({ link, nickname }) =>
      `<p>Hi ${nickname ?? "there"}, click the button below to verify your email.</p><p><a href="${link}">Verify email</a></p><p>Or paste this link into your browser: ${link}</p>`,
  },
  ru: {
    subject: "Подтвердите вашу почту на YanChess",
    html: ({ link, nickname }) =>
      `<p>Привет, ${nickname ?? ""}! Нажмите кнопку ниже, чтобы подтвердить вашу почту.</p><p><a href="${link}">Подтвердить</a></p><p>Или вставьте эту ссылку в браузер: ${link}</p>`,
  },
  es: {
    subject: "Verifica tu correo en YanChess",
    html: ({ link, nickname }) =>
      `<p>Hola, ${nickname ?? ""}! haz clic en el botón para verificar tu correo.</p><p><a href="${link}">Verificar correo</a></p><p>O copia este enlace en tu navegador: ${link}</p>`,
  },
};

export function verifyEmailTemplate(ctx: Ctx, lang: Lang): { subject: string; html: string } {
  const tpl = translations[lang];
  if (!tpl) {
    logger.warn(`Unsupported lang "${lang as string}" for verifyEmailTemplate, falling back to "en"`);
    return { subject: translations.en.subject, html: translations.en.html(ctx) };
  }
  return { subject: tpl.subject, html: tpl.html(ctx) };
}
