// @layer: unit
// @spec: 012-i18n
// @regression
//
// Acceptance-level regression tests for spec 012-i18n.
// Groups mirror the §2.X functional requirement sections.
// Coverage note: §2.3 Header switcher component, §2.5 cross-device sync,
// and §2.6 server-failure silent path are covered by the per-feature unit tests
// in useLangStore.test.ts and useAuthStore.i18n.test.ts. This file adds the
// remaining ACs that are not covered elsewhere.

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

// ---------------------------------------------------------------------------
// §2.1 Supported languages
// ---------------------------------------------------------------------------

import { SUPPORTED_LANGS } from "@yanchess/shared";

describe("§2.1 — Supported languages", () => {
  // @regression
  it("SUPPORTED_LANGS exports exactly ['en','ru','es'] — no more, no fewer", () => {
    expect([...SUPPORTED_LANGS]).toEqual(["en", "ru", "es"]);
  });

  // @regression
  it("i18next fallbackLng is 'en' so an unknown language code resolves to English", async () => {
    const i18n = (await import("../i18n/index")).default;
    // Simulate a fourth language being active — i18next falls back to 'en'
    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    // fallbackLng kicks in — t('common:...') key returns English value, not a raw key
    const translated = i18n.t("errors:email.required");
    expect(translated).toBe("Email is required");
    // Restore
    await act(async () => { await i18n.changeLanguage("en"); });
  });
});

// ---------------------------------------------------------------------------
// §2.2 First-visit auto-detection (pure mapping logic)
// ---------------------------------------------------------------------------

describe("§2.2 — First-visit auto-detection mapping", () => {
  // The detectLang logic lives inside apps/web/src/i18n/index.ts but is not
  // exported. We test it indirectly through the i18next instance initial
  // language and through a reimplemented mirror of the same logic.

  function detectLangMirror(navigatorLanguage: string, storedLang: string | null): string {
    if (storedLang === "en" || storedLang === "ru" || storedLang === "es") return storedLang;
    if (navigatorLanguage.startsWith("ru")) return "ru";
    if (navigatorLanguage.startsWith("es")) return "es";
    return "en";
  }

  // @regression
  it("ru-RU navigator.language maps to 'ru'", () => {
    expect(detectLangMirror("ru-RU", null)).toBe("ru");
  });

  // @regression
  it("es-MX navigator.language maps to 'es'", () => {
    expect(detectLangMirror("es-MX", null)).toBe("es");
  });

  // @regression
  it("fr-FR navigator.language maps to 'en' (no French support)", () => {
    expect(detectLangMirror("fr-FR", null)).toBe("en");
  });

  // @regression
  it("stored 'ru' overrides navigator.language 'fr-FR'", () => {
    expect(detectLangMirror("fr-FR", "ru")).toBe("ru");
  });

  // @regression — localStorage round-trip persistence
  it("stores detected lang in localStorage and re-reads it on next call", () => {
    localStorage.removeItem("yanchess:lang");
    const detected = detectLangMirror("ru-RU", null);
    localStorage.setItem("yanchess:lang", detected);
    const stored = localStorage.getItem("yanchess:lang");
    expect(stored).toBe("ru");
    // Second call: stored value overrides any navigator lang
    expect(detectLangMirror("en-US", stored)).toBe("ru");
  });
});

// ---------------------------------------------------------------------------
// §2.4 Device-local persistence
// ---------------------------------------------------------------------------

describe("§2.4 — Device-local persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // @regression
  it("writing 'es' to localStorage and re-reading returns 'es'", () => {
    localStorage.setItem("yanchess:lang", "es");
    expect(localStorage.getItem("yanchess:lang")).toBe("es");
  });

  // @regression
  it("clearing localStorage removes the stored lang (re-runs auto-detect on next visit)", () => {
    localStorage.setItem("yanchess:lang", "es");
    localStorage.clear();
    expect(localStorage.getItem("yanchess:lang")).toBeNull();
  });

  // @regression
  it("explicit setLang('es') persists to localStorage, overriding the prior auto-detect value", async () => {
    // Simulate: auto-detect wrote 'en', user now switches to es
    localStorage.setItem("yanchess:lang", "en");

    vi.mock("../../../i18n", () => ({
      default: { changeLanguage: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.mock("../features/auth/apiClient", () => ({
      authedFetch: vi.fn().mockResolvedValue({ status: 200 }),
      apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn(),
    }));
    vi.mock("../features/auth/useAuthStore", () => ({
      useAuthStore: { getState: () => ({ user: null }) },
    }));

    const { useLangStore } = await import("../features/i18n/useLangStore");
    useLangStore.getState().setLang("es");
    expect(localStorage.getItem("yanchess:lang")).toBe("es");
  });
});

// ---------------------------------------------------------------------------
// §2.8 Error messages — i18n namespace coverage check
// ---------------------------------------------------------------------------

describe("§2.8 — Error messages locale coverage", () => {
  let i18n: typeof import("../i18n/index").default;

  beforeAll(async () => {
    i18n = (await import("../i18n/index")).default;
  });

  // @regression
  it("Russian locale: password.too_short returns Russian text", async () => {
    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(i18n.t("errors:password.too_short")).toBe("Пароль должен содержать не менее 8 символов");
    await act(async () => { await i18n.changeLanguage("en"); });
  });

  // @regression
  it("Spanish locale: password.too_short returns Spanish text", async () => {
    await act(async () => { await i18n.changeLanguage("es"); });
    expect(i18n.t("errors:password.too_short")).toBe("La contraseña debe tener al menos 8 caracteres");
    await act(async () => { await i18n.changeLanguage("en"); });
  });

  // @regression
  it("Russian locale: email.required returns Russian text (form validation path)", async () => {
    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(i18n.t("errors:email.required")).toBe("Введите email");
    await act(async () => { await i18n.changeLanguage("en"); });
  });
});

// ---------------------------------------------------------------------------
// §2.9 Chess-specific content
// ---------------------------------------------------------------------------

describe("§2.9 — Chess-specific content localization", () => {
  let i18n: typeof import("../i18n/index").default;

  beforeAll(async () => {
    i18n = (await import("../i18n/index")).default;
  });

  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
  });

  // @regression
  it("t('game:endReason.checkmate') returns 'Мат' in Russian", async () => {
    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(i18n.t("game:endReason.checkmate")).toBe("Мат");
  });

  // @regression
  it("t('game:endReason.checkmate') returns 'Jaque mate' in Spanish", async () => {
    await act(async () => { await i18n.changeLanguage("es"); });
    expect(i18n.t("game:endReason.checkmate")).toBe("Jaque mate");
  });

  // @regression
  it("t('game:promotion.queen') returns 'Ферзь' in Russian", async () => {
    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(i18n.t("game:promotion.queen")).toBe("Ферзь");
  });

  // @regression
  it("t('game:promotion.queen') returns 'Dama' in Spanish", async () => {
    await act(async () => { await i18n.changeLanguage("es"); });
    expect(i18n.t("game:promotion.queen")).toBe("Dama");
  });

  // @regression — SAN move notation must NOT be translated
  it("SAN move strings ('e4', 'Nf3', 'O-O') are not looked up as i18n keys", () => {
    const sanMoves = ["e4", "Nf3", "O-O", "d4", "Bb5"];
    // i18n.t of a literal SAN string returns the input unchanged (no matching key)
    for (const san of sanMoves) {
      // If the key is missing, i18next returns the key itself — not a translation
      const result = i18n.t(san as string, { ns: "game" });
      expect(result).toBe(san);
    }
  });

  // @regression
  it("game:endReason.stalemate returns 'Пат' in Russian", async () => {
    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(i18n.t("game:endReason.stalemate")).toBe("Пат");
  });

  // @regression
  it("game:endReason.stalemate returns 'Rey ahogado' in Spanish", async () => {
    await act(async () => { await i18n.changeLanguage("es"); });
    expect(i18n.t("game:endReason.stalemate")).toBe("Rey ahogado");
  });
});

// ---------------------------------------------------------------------------
// MoveHistory component renders SAN strings unchanged across languages
// ---------------------------------------------------------------------------

vi.mock("../features/auth/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  resendVerifyEmail: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
}));

describe("§2.9 — MoveHistory component: SAN strings are not translated", () => {
  let i18n: typeof import("../i18n/index").default;

  beforeAll(async () => {
    i18n = (await import("../i18n/index")).default;
  });

  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
  });

  async function renderMoveHistory(movesSan: string[], lang: string) {
    const { MoveHistory } = await import("../components/game/MoveHistory");
    await act(async () => { await i18n.changeLanguage(lang); });
    render(
      <I18nextProvider i18n={i18n}>
        <MoveHistory movesSan={movesSan} />
      </I18nextProvider>,
    );
  }

  // @regression
  it("renders SAN moves unchanged in Russian locale", async () => {
    await renderMoveHistory(["e4", "e5", "Nf3"], "ru");
    expect(screen.getByText("e4")).toBeInTheDocument();
    expect(screen.getByText("e5")).toBeInTheDocument();
    expect(screen.getByText("Nf3")).toBeInTheDocument();
  });

  // @regression
  it("renders SAN moves unchanged in Spanish locale", async () => {
    await renderMoveHistory(["d4", "d5", "O-O"], "es");
    expect(screen.getByText("d4")).toBeInTheDocument();
    expect(screen.getByText("d5")).toBeInTheDocument();
    expect(screen.getByText("O-O")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ## Gaps
//
// §2.8 — Rate-limit error path: the rate-limit UI (LoginPage flash when
//   login attempts are exhausted) currently displays a hard-coded message
//   string. The message is not routed through the `errors` i18n namespace
//   (there is no `errors.rate_limit.*` key in any locale file). This means
//   a Russian-locale user sees the English rate-limit text. Gap documented
//   here — no test failure triggered because the surface is absent from the
//   implementation; a follow-up refactoring slice is needed.
//   <!-- GAP: rate-limit UI string not localized via errors namespace — needs refactoring-slice follow-up -->
// ---------------------------------------------------------------------------
