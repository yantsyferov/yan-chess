import { Logger } from "@nestjs/common";
import type { Lang } from "@yanchess/shared";

const logger = new Logger("resetPasswordTemplate");

type Ctx = { link: string; nickname?: string };

const translations: Record<Lang, { subject: string; html: (ctx: Ctx) => string }> = {
  en: {
    subject: "Reset your YanChess password",
    html: ({ link, nickname }) =>
      `<p>Hi ${nickname ?? "there"}, you asked to reset your password. Click below to continue — this link expires in 15 minutes.</p><p><a href="${link}">Reset password</a></p><p>Or paste this link into your browser: ${link}</p>`,
  },
  ru: {
    subject: "Сброс пароля на YanChess",
    html: ({ link, nickname }) =>
      `<p>Привет, ${nickname ?? ""}! Вы запросили сброс пароля. Нажмите на кнопку ниже — ссылка действительна 15 минут.</p><p><a href="${link}">Сбросить пароль</a></p><p>Или вставьте эту ссылку в браузер: ${link}</p>`,
  },
  es: {
    subject: "Restablecer tu contraseña en YanChess",
    html: ({ link, nickname }) =>
      `<p>Hola, ${nickname ?? ""}! pediste restablecer tu contraseña. Haz clic en el botón — el enlace caduca en 15 minutos.</p><p><a href="${link}">Restablecer contraseña</a></p><p>O copia este enlace en tu navegador: ${link}</p>`,
  },
};

export function resetPasswordTemplate(ctx: Ctx, lang: Lang): { subject: string; html: string } {
  const tpl = translations[lang];
  if (!tpl) {
    logger.warn(`Unsupported lang "${lang as string}" for resetPasswordTemplate, falling back to "en"`);
    return { subject: translations.en.subject, html: translations.en.html(ctx) };
  }
  return { subject: tpl.subject, html: tpl.html(ctx) };
}
