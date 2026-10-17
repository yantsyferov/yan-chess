// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/index";
import { useLangStore } from "../../i18n/useLangStore";
import { CountryPicker } from "../CountryPicker";

// authedFetch may be triggered by lang store — stub it
vi.mock("../../auth/apiClient", () => ({
  authedFetch: vi.fn(() => Promise.resolve(null)),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

// useAuthStore — no logged-in user, so lang store skips PATCH
vi.mock("../../auth/useAuthStore", () => ({
  useAuthStore: {
    getState: () => ({ user: null }),
  },
}));

function renderPicker(props: Parameters<typeof CountryPicker>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CountryPicker {...props} />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  useLangStore.setState({ current: "en" });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  useLangStore.setState({ current: "en" });
});

describe("CountryPicker — placeholder when value=null", () => {
  it("shows placeholder text when no value is provided", () => {
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });
    expect(screen.getByText("Select country")).toBeInTheDocument();
  });
});

describe("CountryPicker — selected value display", () => {
  it("shows flag and localized name when value is set to MX", () => {
    const onChange = vi.fn();
    const { container } = renderPicker({ value: "MX", onChange });
    expect(container.querySelector(".fi.fi-mx")).not.toBeNull();
    expect(screen.getByText("Mexico")).toBeInTheDocument();
  });
});

describe("CountryPicker — dropdown opens", () => {
  it("shows search input and list after clicking trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    const trigger = screen.getByRole("button", { name: /no country selected/i });
    await user.click(trigger);

    expect(screen.getByPlaceholderText("Search country...")).toBeInTheDocument();
    // At least some countries in the list
    expect(screen.getAllByRole("option").length).toBeGreaterThan(10);
  });
});

describe("CountryPicker — search filter", () => {
  it("filters countries to Mexico when query is 'Mex'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    const trigger = screen.getByRole("button", { name: /no country selected/i });
    await user.click(trigger);

    const search = screen.getByPlaceholderText("Search country...");
    await user.type(search, "Mex");

    const options = screen.getAllByRole("option");
    expect(options.length).toBe(1);
    expect(options[0]).toHaveTextContent("Mexico");
  });
});

describe("CountryPicker — onChange callback", () => {
  it("calls onChange with the correct 2-letter code when a country row is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    await user.click(screen.getByRole("button", { name: /no country selected/i }));
    await user.type(screen.getByPlaceholderText("Search country..."), "Mex");

    const mexicoButton = screen.getByRole("button", { name: /Mexico/ });
    await user.click(mexicoButton);

    expect(onChange).toHaveBeenCalledWith("MX");
  });
});

describe("CountryPicker — Russian locale search", () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
    useLangStore.setState({ current: "ru" });
  });

  it("finds Mexico when searching in Russian 'Мекс'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    await user.click(screen.getByRole("button", { name: /страна не выбрана/i }));
    await user.type(screen.getByPlaceholderText("Поиск страны..."), "Мекс");

    const options = screen.getAllByRole("option");
    expect(options.length).toBe(1);
    expect(options[0]).toHaveTextContent("Мексика");
  });

  it("displays Mexico in Russian as 'Мексика' when value is MX", () => {
    const onChange = vi.fn();
    renderPicker({ value: "MX", onChange });
    expect(screen.getByText("Мексика")).toBeInTheDocument();
  });
});
