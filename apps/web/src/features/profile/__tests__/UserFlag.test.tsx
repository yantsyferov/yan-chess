// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserFlag } from "../UserFlag";

describe("UserFlag", () => {
  it("returns the correct flag emoji for a known code (MX → 🇲🇽)", () => {
    render(<UserFlag country="MX" />);
    const el = screen.getByLabelText("Mexico");
    expect(el.textContent).toBe("🇲🇽");
  });

  it("returns white flag 🏳 when country is null", () => {
    render(<UserFlag country={null} />);
    const el = screen.getByLabelText("No country");
    expect(el.textContent).toBe("🏳");
  });

  it("aria-label is country's English name when set", () => {
    render(<UserFlag country="MX" />);
    expect(screen.getByLabelText("Mexico")).toBeTruthy();
  });

  it("aria-label is 'No country' when country is null", () => {
    render(<UserFlag country={null} />);
    expect(screen.getByLabelText("No country")).toBeTruthy();
  });
});
