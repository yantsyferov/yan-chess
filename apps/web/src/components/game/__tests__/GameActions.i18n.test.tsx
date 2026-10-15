// @layer: unit
// @spec: 012-i18n
// @regression

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { GameActions } from "../GameActions";

const noop = vi.fn();

function renderWithI18n(lng: string): void {
  i18n.changeLanguage(lng);
  render(
    <I18nextProvider i18n={i18n}>
      <GameActions canAct={true} onResignClick={noop} onOfferDraw={noop} />
    </I18nextProvider>,
  );
}

describe("GameActions i18n", () => {
  afterAll(() => {
    void i18n.changeLanguage("en");
  });

  it("renders Russian labels when language is ru", () => {
    renderWithI18n("ru");
    expect(screen.getByRole("button", { name: "Сдаться" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Предложить ничью" })).toBeInTheDocument();
  });

  it("renders English labels when language is en", () => {
    renderWithI18n("en");
    expect(screen.getByRole("button", { name: "Resign" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Offer draw" })).toBeInTheDocument();
  });

  it("renders Spanish labels when language is es", () => {
    renderWithI18n("es");
    expect(screen.getByRole("button", { name: "Abandonar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ofrecer tablas" })).toBeInTheDocument();
  });
});
