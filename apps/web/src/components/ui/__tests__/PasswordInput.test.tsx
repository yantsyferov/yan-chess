// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "../PasswordInput";

describe("PasswordInput", () => {
  // @regression
  it("initial type is password (characters hidden)", () => {
    render(<PasswordInput label="Password" name="password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
  });

  // @regression
  it("eye button has aria-label 'Show password' when hidden", () => {
    render(<PasswordInput label="Password" name="password" />);
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  // @regression
  it("click eye button reveals password (type becomes text)", async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" name="password" />);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "text");
  });

  // @regression
  it("eye button aria-label switches to 'Hide password' after reveal", async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" name="password" />);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  // @regression
  it("second click hides password again (type returns to password)", async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" name="password" />);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
  });

  // @regression (negative)
  it("does not reveal password without interaction", () => {
    render(<PasswordInput label="Password" name="password" />);
    const input = screen.getByLabelText("Password");
    expect(input).not.toHaveAttribute("type", "text");
  });
});
