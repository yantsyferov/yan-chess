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

import enGame from "./locales/en/game.json";
import ruGame from "./locales/ru/game.json";
import esGame from "./locales/es/game.json";

import enProfile from "./locales/en/profile.json";
import ruProfile from "./locales/ru/profile.json";
import esProfile from "./locales/es/profile.json";

import enHistory from "./locales/en/history.json";
import ruHistory from "./locales/ru/history.json";
import esHistory from "./locales/es/history.json";

import enFriends from "./locales/en/friends.json";
import ruFriends from "./locales/ru/friends.json";
import esFriends from "./locales/es/friends.json";

import enAnalysis from "./locales/en/analysis.json";
import ruAnalysis from "./locales/ru/analysis.json";
import esAnalysis from "./locales/es/analysis.json";

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
      en: { common: enCommon, auth: enAuth, errors: enErrors, game: enGame, profile: enProfile, history: enHistory, friends: enFriends, analysis: enAnalysis },
      ru: { common: ruCommon, auth: ruAuth, errors: ruErrors, game: ruGame, profile: ruProfile, history: ruHistory, friends: ruFriends, analysis: ruAnalysis },
      es: { common: esCommon, auth: esAuth, errors: esErrors, game: esGame, profile: esProfile, history: esHistory, friends: esFriends, analysis: esAnalysis },
    },
    interpolation: { escapeValue: false },
  });

import { zodErrorMap } from "../lib/zodErrorMap";
z.setErrorMap(zodErrorMap);

export default i18n;
