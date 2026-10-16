// @layer: unit
// @spec: 016-component-extraction
// @regression

import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../../i18n";
import { RatedBadge } from "../RatedBadge";

afterEach(() => {
  void i18n.changeLanguage("en");
});

describe("RatedBadge", () => {
  it("shows 'Rated' label when isRated=true (English)", () => {
    void i18n.changeLanguage("en");
    render(<RatedBadge isRated={true} />);
    expect(screen.getByText("Rated")).toBeInTheDocument();
  });

  it("shows 'Casual' label when isRated=false (English)", () => {
    void i18n.changeLanguage("en");
    render(<RatedBadge isRated={false} />);
    expect(screen.getByText("Casual")).toBeInTheDocument();
  });

  it("applies accent class when isRated=true", () => {
    render(<RatedBadge isRated={true} />);
    const badge = screen.getByText("Rated");
    expect(badge.className).toContain("bg-accent/10");
    expect(badge.className).toContain("text-accent");
  });

  it("applies secondary class when isRated=false", () => {
    render(<RatedBadge isRated={false} />);
    const badge = screen.getByText("Casual");
    expect(badge.className).toContain("bg-surface-elevated");
    expect(badge.className).toContain("text-text-secondary");
  });

  it("shows Russian label when language is ru", async () => {
    await i18n.changeLanguage("ru");
    render(<RatedBadge isRated={true} />);
    expect(screen.getByText("Рейтинговая")).toBeInTheDocument();
  });
});
