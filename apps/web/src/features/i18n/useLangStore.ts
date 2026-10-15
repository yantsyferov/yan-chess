import { create } from "zustand";
import type { Lang } from "@yanchess/shared";
import i18n from "../../i18n";
import { useAuthStore } from "../auth/useAuthStore";
import { authedFetch } from "../auth/apiClient";

const LANG_KEY = "yanchess:lang";

interface SetLangOptions {
  skipPatch?: boolean;
}

interface LangState {
  current: Lang;
  setLang: (lang: Lang, options?: SetLangOptions) => void;
}

export const useLangStore = create<LangState>((set) => ({
  current: (localStorage.getItem(LANG_KEY) as Lang | null) ?? "en",
  setLang: (lang: Lang, options?: SetLangOptions) => {
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

    if (!options?.skipPatch && useAuthStore.getState().user !== null) {
      void authedFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ lang }),
      }).catch(() => {
        // swallow — spec §2.6
      });
    }
  },
}));
