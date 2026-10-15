import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import ruCommon from "./locales/ru/common.json";
import esCommon from "./locales/es/common.json";

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
      en: { common: enCommon },
      ru: { common: ruCommon },
      es: { common: esCommon },
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
