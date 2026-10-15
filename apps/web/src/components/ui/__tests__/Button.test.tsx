// @layer: unit
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button";

describe("Button", () => {
  // @regression
  it("renders button text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  // @regression
  it("applies primary variant class", () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-accent");
  });

  // @regression
  it("applies secondary variant class", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border");
  });

  // @regression
  it("applies size classes", () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-6");
  });

  // @regression
  it("shows spinner and hides label text when isLoading", () => {
    render(<Button isLoading>Submit</Button>);
    // The label is rendered with invisible class, and a spinner svg exists
    const btn = screen.getByRole("button");
    const invisible = btn.querySelector(".invisible");
    expect(invisible).toBeInTheDocument();
    expect(invisible?.textContent).toBe("Submit");
    // Loader2 icon rendered as an svg
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  // @regression
  it("is disabled when isLoading=true and does not fire onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button isLoading onClick={onClick}>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  // @regression
  it("is disabled when disabled prop is set", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  // @regression
  it("fires onClick when enabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // @regression
  it("has focus-visible outline class for a11y", () => {
    render(<Button>Focus</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("focus-visible:outline");
  });
});
