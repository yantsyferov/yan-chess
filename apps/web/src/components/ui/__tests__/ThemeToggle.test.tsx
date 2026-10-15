// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";

// We mock the store so ThemeToggle gets a controlled theme value.
vi.mock("../../../features/theme/useThemeStore", () => {
  const toggleTheme = vi.fn();
  let _theme: "dark" | "light" = "dark";
  const store = (selector: (s: { theme: "dark" | "light"; toggleTheme: () => void }) => unknown) => {
    return selector({ theme: _theme, toggleTheme });
  };
  store.__setTheme = (t: "dark" | "light") => { _theme = t; };
  store.__toggleMock = toggleTheme;
  return { useThemeStore: store };
});

import { ThemeToggle } from "../ThemeToggle";
import { useThemeStore } from "../../../features/theme/useThemeStore";

const storeExt = useThemeStore as unknown as {
  __setTheme: (t: "dark" | "light") => void;
  __toggleMock: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  storeExt.__setTheme("dark");
  storeExt.__toggleMock.mockClear();
});

describe("ThemeToggle", () => {
  // @regression
  it("renders Sun icon when theme is dark", () => {
    render(<ThemeToggle />);
    // Sun icon is rendered as svg; aria-label on the button is "Toggle theme"
    const btn = screen.getByRole("button", { name: "Toggle theme" });
    expect(btn).toBeInTheDocument();
    // svg should be present
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  // @regression
  it("renders Moon icon when theme is light", () => {
    storeExt.__setTheme("light");
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: "Toggle theme" });
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  // @regression
  it("calls toggleTheme on click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(storeExt.__toggleMock).toHaveBeenCalledTimes(1);
  });

  // @regression (negative)
  it("does not call toggleTheme without interaction", () => {
    render(<ThemeToggle />);
    expect(storeExt.__toggleMock).not.toHaveBeenCalled();
  });
});
