import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Lang } from "@yanchess/shared";

// Mock i18n before importing the store
vi.mock("../../../i18n", () => ({
  default: {
    changeLanguage: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("useLangStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("setLang writes to localStorage", async () => {
    const { useLangStore } = await import("../useLangStore");
    useLangStore.getState().setLang("ru" as Lang);
    expect(localStorage.getItem("yanchess:lang")).toBe("ru");
  });

  it("setLang calls i18next changeLanguage", async () => {
    const i18n = (await import("../../../i18n")).default;
    const { useLangStore } = await import("../useLangStore");
    useLangStore.getState().setLang("es" as Lang);
    expect(i18n.changeLanguage).toHaveBeenCalledWith("es");
  });

  it("setLang updates store current value", async () => {
    const { useLangStore } = await import("../useLangStore");
    useLangStore.getState().setLang("ru" as Lang);
    expect(useLangStore.getState().current).toBe("ru");
  });

  it("setLang sets document.documentElement.lang", async () => {
    const { useLangStore } = await import("../useLangStore");
    useLangStore.getState().setLang("es" as Lang);
    expect(document.documentElement.lang).toBe("es");
  });
});
