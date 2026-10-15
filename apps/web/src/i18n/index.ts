import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { z } from "zod";

import enCommon from "./locales/en/common.json";
import ruCommon from "./locales/ru/common.json";
import esCommon from "./locales/es/common.json";

import enAuth from "./locales/en/auth.json";
import ruAuth from "./locales/ru/auth.json";
import esAuth from "./locales/es/auth.json";

import enErrors from "./locales/en/errors.json";
import ruErrors from "./locales/ru/errors.json";
import esErrors from "./locales/es/errors.json";

const LANG_KEY = "yanchess:lang";

function detectLang(): string {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "ru" || stored === "es") return stored;
    const nav = navigator.language ?? "";
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("es")) return "es";
  } catch {
    // ignore SSR / sandboxed environments
  }
  return "en";
}

void i18n
  .use(initReactI18next)
  .init({
    lng: detectLang(),
    fallbackLng: "en",
    defaultNS: "common",
    resources: {
      en: { common: enCommon, auth: enAuth, errors: enErrors },
      ru: { common: ruCommon, auth: ruAuth, errors: ruErrors },
      es: { common: esCommon, auth: esAuth, errors: esErrors },
    },
    interpolation: { escapeValue: false },
  });

import { zodErrorMap } from "../lib/zodErrorMap";
z.setErrorMap(zodErrorMap);

export default i18n;
