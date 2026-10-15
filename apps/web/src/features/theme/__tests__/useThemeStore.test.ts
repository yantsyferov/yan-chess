// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { beforeEach, describe, expect, it } from "vitest";
import { act } from "react";

// Reset the store module between tests so we start fresh each time.
// We do this by re-importing with a fresh store state via `act`.

let useThemeStore: typeof import("../useThemeStore").useThemeStore;

beforeEach(async () => {
  // Reimport fresh each test (Vitest module cache is per-run by default for `vitest run`).
  const mod = await import("../useThemeStore");
  useThemeStore = mod.useThemeStore;
  // Reset store to dark default
  act(() => {
    useThemeStore.setState({ theme: "dark" });
  });
});

describe("useThemeStore", () => {
  describe("hydrate", () => {
    // @regression
    it("reads theme from localStorage on hydrate", () => {
      localStorage.setItem("theme", "light");
      act(() => {
        useThemeStore.getState().hydrate();
      });
      expect(useThemeStore.getState().theme).toBe("light");
    });

    // @regression
    it("falls back to dark when localStorage is empty and matchMedia is dark", () => {
      localStorage.clear();
      // jsdom has no matchMedia — hydrate falls through to "dark"
      act(() => {
        useThemeStore.getState().hydrate();
      });
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    // @regression (negative)
    it("ignores invalid localStorage value and falls back to dark", () => {
      localStorage.setItem("theme", "purple");
      act(() => {
        useThemeStore.getState().hydrate();
      });
      // "purple" is not a valid Theme — readStoredTheme skips it
      expect(useThemeStore.getState().theme).toBe("dark");
    });
  });

  describe("setTheme", () => {
    // @regression
    it("sets theme in store", () => {
      act(() => {
        useThemeStore.getState().setTheme("light");
      });
      expect(useThemeStore.getState().theme).toBe("light");
    });

    // @regression
    it("writes to localStorage", () => {
      act(() => {
        useThemeStore.getState().setTheme("light");
      });
      expect(localStorage.getItem("theme")).toBe("light");
    });

    // @regression
    it("updates data-theme attribute on documentElement", () => {
      act(() => {
        useThemeStore.getState().setTheme("light");
      });
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });

  describe("toggleTheme", () => {
    // @regression
    it("flips dark → light and writes localStorage", () => {
      act(() => {
        useThemeStore.setState({ theme: "dark" });
        document.documentElement.dataset.theme = "dark";
      });
      act(() => {
        useThemeStore.getState().toggleTheme();
      });
      expect(useThemeStore.getState().theme).toBe("light");
      expect(localStorage.getItem("theme")).toBe("light");
    });

    // @regression
    it("flips light → dark", () => {
      act(() => {
        useThemeStore.setState({ theme: "light" });
        document.documentElement.dataset.theme = "light";
      });
      act(() => {
        useThemeStore.getState().toggleTheme();
      });
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    // @regression
    it("updates data-theme attribute after toggle", () => {
      act(() => {
        useThemeStore.setState({ theme: "dark" });
        document.documentElement.dataset.theme = "dark";
      });
      act(() => {
        useThemeStore.getState().toggleTheme();
      });
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });
});
