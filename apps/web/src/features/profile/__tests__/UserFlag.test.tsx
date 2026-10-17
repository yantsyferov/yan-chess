// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserFlag } from "../UserFlag";

describe("UserFlag", () => {
  it("renders a flag-icons span with the lowercased ISO code for a known country", () => {
    render(<UserFlag country="MX" />);
    const el = screen.getByLabelText("Mexico");
    expect(el.className).toContain("fi");
    expect(el.className).toContain("fi-mx");
  });

  it("renders a placeholder (no fi-xx class) when country is null", () => {
    render(<UserFlag country={null} />);
    const el = screen.getByLabelText("No country selected");
    expect(el.className).not.toContain("fi-");
  });

  it("aria-label is country's English name when set", () => {
    render(<UserFlag country="MX" />);
    expect(screen.getByLabelText("Mexico")).toBeTruthy();
  });

  it("aria-label is 'No country selected' when country is null", () => {
    render(<UserFlag country={null} />);
    expect(screen.getByLabelText("No country selected")).toBeTruthy();
  });
});
