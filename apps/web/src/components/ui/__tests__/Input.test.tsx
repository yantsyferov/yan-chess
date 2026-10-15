// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  // @regression
  it("renders an input with label linked via htmlFor/id", () => {
    render(<Input label="Email" name="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  // @regression
  it("passes name attribute to input", () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
  });

  // @regression
  it("shows error message and sets aria-invalid when error prop provided", () => {
    render(<Input label="Email" name="email" error="Field is required" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Field is required")).toBeInTheDocument();
  });

  // @regression
  it("error element has role=alert for screen reader announcement", () => {
    render(<Input label="Email" name="email" error="Error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Error");
  });

  // @regression
  it("does not have aria-invalid when no error", () => {
    render(<Input label="Email" name="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  // @regression
  it("does not show role=alert when no error", () => {
    render(<Input label="Email" name="email" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // @regression
  it("forwards ref to underlying input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Email" name="email" ref={ref} />);
    expect(ref.current?.tagName).toBe("INPUT");
  });
});
