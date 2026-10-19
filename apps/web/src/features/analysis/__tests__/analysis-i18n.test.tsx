// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../../i18n/index";
import { MoveQualityTiles } from "../MoveQualityTiles";

const buckets = { standout: 1, normal: 2, mistake: 3 };

describe("MoveQualityTiles i18n — Russian", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ru");
  });

  it("renders tile labels in Russian", () => {
    render(<MoveQualityTiles status="done" buckets={buckets} />);
    expect(screen.getByText("Отличные")).toBeTruthy();
    expect(screen.getByText("Нормальные")).toBeTruthy();
    expect(screen.getByText("Ошибки")).toBeTruthy();
  });

  it("resolves status.analyzing in Russian", () => {
    expect(i18n.t("analysis:status.analyzing")).toBe("Анализ…");
  });
});

describe("MoveQualityTiles i18n — Spanish", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("es");
  });

  it("renders tile labels in Spanish", () => {
    render(<MoveQualityTiles status="done" buckets={buckets} />);
    expect(screen.getByText("Destacadas")).toBeTruthy();
    expect(screen.getByText("Normales")).toBeTruthy();
    expect(screen.getByText("Errores")).toBeTruthy();
  });

  it("resolves status.analyzing in Spanish", () => {
    expect(i18n.t("analysis:status.analyzing")).toBe("Analizando…");
  });
});
