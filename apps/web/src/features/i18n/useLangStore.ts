import { create } from "zustand";
import type { Lang } from "@yanchess/shared";
import i18n from "../../i18n";

const LANG_KEY = "yanchess:lang";

interface LangState {
  current: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  current: (localStorage.getItem(LANG_KEY) as Lang | null) ?? "en",
  setLang: (lang: Lang) => {
    void i18n.changeLanguage(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    set({ current: lang });
  },
}));
