// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  // @regression
  it("renders with label text", () => {
    render(<Checkbox label="Remember me" name="remember" />);
    expect(screen.getByLabelText("Remember me")).toBeInTheDocument();
  });

  // @regression
  it("is unchecked by default", () => {
    render(<Checkbox label="Remember me" name="remember" />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  // @regression
  it("toggles checked state on click", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Remember me" name="remember" />);
    const cb = screen.getByRole("checkbox");
    await user.click(cb);
    expect(cb).toBeChecked();
  });

  // @regression
  it("toggles via keyboard Space key", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Remember me" name="remember" />);
    const cb = screen.getByRole("checkbox");
    cb.focus();
    await user.keyboard(" ");
    expect(cb).toBeChecked();
  });

  // @regression (negative)
  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Remember me" name="remember" disabled />);
    const cb = screen.getByRole("checkbox");
    await user.click(cb);
    expect(cb).not.toBeChecked();
  });
});
