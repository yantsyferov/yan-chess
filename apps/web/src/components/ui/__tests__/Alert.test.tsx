// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "../Alert";

describe("Alert", () => {
  // @regression
  it("renders children", () => {
    render(<Alert tone="info">Some message</Alert>);
    expect(screen.getByText("Some message")).toBeInTheDocument();
  });

  // @regression
  it("renders title when provided", () => {
    render(<Alert tone="info" title="Heading">Body</Alert>);
    expect(screen.getByText("Heading")).toBeInTheDocument();
  });

  // @regression
  it("has role=alert when tone is danger", () => {
    render(<Alert tone="danger">Error</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // @regression (negative)
  it("does not have role=alert when tone is info", () => {
    render(<Alert tone="info">Info message</Alert>);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // @regression (negative)
  it("does not have role=alert when tone is success", () => {
    render(<Alert tone="success">Success message</Alert>);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // @regression
  it("applies danger tone class", () => {
    const { container } = render(<Alert tone="danger">Error</Alert>);
    expect(container.firstChild).toHaveClass("text-danger");
  });
});
