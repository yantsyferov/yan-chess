// @layer: unit
// @spec: 016-component-extraction
// @regression

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnlineStatusDot } from "../OnlineStatusDot";

describe("OnlineStatusDot", () => {
  it("has aria-label 'online' when online=true", () => {
    render(<OnlineStatusDot online={true} />);
    expect(screen.getByLabelText("online")).toBeInTheDocument();
  });

  it("has aria-label 'offline' when online=false", () => {
    render(<OnlineStatusDot online={false} />);
    expect(screen.getByLabelText("offline")).toBeInTheDocument();
  });

  it("applies bg-success class when online=true", () => {
    render(<OnlineStatusDot online={true} />);
    const dot = screen.getByLabelText("online");
    expect(dot.className).toContain("bg-success");
  });

  it("applies border class when online=false", () => {
    render(<OnlineStatusDot online={false} />);
    const dot = screen.getByLabelText("offline");
    expect(dot.className).toContain("border");
    expect(dot.className).toContain("border-text-muted");
  });

  it("applies sm size classes by default", () => {
    render(<OnlineStatusDot online={true} />);
    const dot = screen.getByLabelText("online");
    expect(dot.className).toContain("w-2");
    expect(dot.className).toContain("h-2");
  });

  it("applies md size classes when size='md'", () => {
    render(<OnlineStatusDot online={true} size="md" />);
    const dot = screen.getByLabelText("online");
    expect(dot.className).toContain("w-2.5");
    expect(dot.className).toContain("h-2.5");
  });
});
