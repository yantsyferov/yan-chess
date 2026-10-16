import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/index";
import { LanguageSwitcher } from "../LanguageSwitcher";
import type { Lang } from "@yanchess/shared";

vi.mock("../useLangStore", () => {
  let _current: Lang = "en";
  const store = Object.assign(
    (selector: (s: { current: Lang }) => unknown) => selector({ current: _current }),
    {
      getState: () => ({ current: _current }),
      __setCurrent: (lang: Lang) => { _current = lang; },
    },
  );
  return { useLangStore: store };
});

async function renderSwitcher(lang: Lang) {
  const { useLangStore } = await import("../useLangStore") as unknown as {
    useLangStore: { __setCurrent: (lang: Lang) => void };
  };
  (useLangStore as unknown as { __setCurrent: (lang: Lang) => void }).__setCurrent(lang);
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSwitcher />
    </I18nextProvider>,
  );
}

describe("LanguageSwitcher trigger shows full endonym", () => {
  it('shows "English" when locale is en', async () => {
    await renderSwitcher("en");
    expect(screen.getByRole("button")).toHaveTextContent("English");
  });

  it('shows "Русский" when locale is ru', async () => {
    await renderSwitcher("ru");
    expect(screen.getByRole("button")).toHaveTextContent("Русский");
  });

  it('shows "Español" when locale is es', async () => {
    await renderSwitcher("es");
    expect(screen.getByRole("button")).toHaveTextContent("Español");
  });
});
