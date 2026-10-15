// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "../Avatar";

describe("Avatar", () => {
  // @regression
  it("shows first character of nickname uppercased", () => {
    render(<Avatar nickname="alice" />);
    // The initial letter "A" should appear as text content
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  // @regression
  it("uppercases already-uppercase initial", () => {
    render(<Avatar nickname="Bob" />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  // @regression
  it("size sm maps to 28px width", () => {
    render(<Avatar nickname="alice" size="sm" />);
    const el = screen.getByLabelText("avatar");
    expect(el).toHaveStyle({ width: "28px", height: "28px" });
  });

  // @regression
  it("size md (default) maps to 40px", () => {
    render(<Avatar nickname="alice" />);
    const el = screen.getByLabelText("avatar");
    expect(el).toHaveStyle({ width: "40px", height: "40px" });
  });

  // @regression
  it("size lg maps to 64px", () => {
    render(<Avatar nickname="alice" size="lg" />);
    const el = screen.getByLabelText("avatar");
    expect(el).toHaveStyle({ width: "64px", height: "64px" });
  });

  // @regression (negative)
  it("does not show multiple letters — only first char", () => {
    render(<Avatar nickname="charlie" />);
    // The element text should be exactly "C"
    expect(screen.getByLabelText("avatar").textContent).toBe("C");
  });
});
