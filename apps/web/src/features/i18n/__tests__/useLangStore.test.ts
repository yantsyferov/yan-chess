import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Lang } from "@yanchess/shared";

// Mock i18n before importing the store
vi.mock("../../../i18n", () => ({
  default: {
    changeLanguage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock apiClient so we can spy on authedFetch
vi.mock("../../auth/apiClient", () => ({
  authedFetch: vi.fn().mockResolvedValue({ status: 200, ok: true, body: null }),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

// Mock useAuthStore so we can control signed-in/out state
vi.mock("../../auth/useAuthStore", () => {
  let _user: { id: string } | null = null;
  const store = {
    getState: () => ({
      user: _user,
      accessToken: _user ? "tok" : null,
      setSession: vi.fn(),
      clear: vi.fn(),
    }),
  };
  return {
    useAuthStore: store,
    __setUser: (u: { id: string } | null) => { _user = u; },
  };
});

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

  describe("PATCH behaviour", () => {
    it("signed-out setLang: no fetch call made", async () => {
      const { __setUser } = await import("../../auth/useAuthStore") as unknown as { __setUser: (u: null) => void };
      __setUser(null);
      const { authedFetch } = await import("../../auth/apiClient");
      const { useLangStore } = await import("../useLangStore");
      useLangStore.getState().setLang("ru" as Lang);
      expect(authedFetch).not.toHaveBeenCalled();
    });

    it("signed-in setLang: fetch IS called with correct method/body", async () => {
      const authModule = await import("../../auth/useAuthStore") as unknown as { __setUser: (u: { id: string }) => void };
      authModule.__setUser({ id: "user-1" });
      const { authedFetch } = await import("../../auth/apiClient");
      const { useLangStore } = await import("../useLangStore");
      useLangStore.getState().setLang("es" as Lang);
      expect(authedFetch).toHaveBeenCalledWith("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ lang: "es" }),
      });
    });

    it("signed-in setLang with { skipPatch: true }: no fetch call", async () => {
      const authModule = await import("../../auth/useAuthStore") as unknown as { __setUser: (u: { id: string }) => void };
      authModule.__setUser({ id: "user-1" });
      const { authedFetch } = await import("../../auth/apiClient");
      const { useLangStore } = await import("../useLangStore");
      useLangStore.getState().setLang("ru" as Lang, { skipPatch: true });
      expect(authedFetch).not.toHaveBeenCalled();
    });

    it("signed-in setLang when fetch rejects: store and localStorage still updated", async () => {
      const authModule = await import("../../auth/useAuthStore") as unknown as { __setUser: (u: { id: string }) => void };
      authModule.__setUser({ id: "user-1" });
      const { authedFetch } = await import("../../auth/apiClient");
      vi.mocked(authedFetch).mockRejectedValueOnce(new Error("network error"));
      const { useLangStore } = await import("../useLangStore");
      useLangStore.getState().setLang("ru" as Lang);
      expect(useLangStore.getState().current).toBe("ru");
      expect(localStorage.getItem("yanchess:lang")).toBe("ru");
      // Allow the rejected promise to settle without throwing
      await new Promise((r) => setTimeout(r, 0));
    });
  });
});
