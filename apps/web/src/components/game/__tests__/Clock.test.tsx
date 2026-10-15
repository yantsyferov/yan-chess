// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Clock } from "../Clock";

describe("Clock component", () => {
  it("renders 3:00 when ms=180000", () => {
    // @regression
    render(<Clock ms={180_000} isActive={false} />);
    expect(screen.getByText("3:00")).toBeInTheDocument();
  });

  it("renders 9.5 with text-danger class when ms=9500", () => {
    // @regression
    const { container } = render(<Clock ms={9_500} isActive={false} />);
    expect(screen.getByText("9.5")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-danger");
  });

  it("has border-accent class when isActive=true", () => {
    // @regression
    const { container } = render(<Clock ms={180_000} isActive={true} />);
    expect(container.firstChild).toHaveClass("border-accent");
  });

  it("does not have border-accent class when isActive=false", () => {
    // @regression
    const { container } = render(<Clock ms={180_000} isActive={false} />);
    expect(container.firstChild).not.toHaveClass("border-accent");
  });
});
