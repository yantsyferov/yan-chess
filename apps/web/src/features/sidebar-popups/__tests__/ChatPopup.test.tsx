// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "../../../i18n/index";

import { ChatPopup } from "../ChatPopup";

describe("ChatPopup", () => {
  it("renders the heading", () => {
    render(<ChatPopup />);
    expect(screen.getByRole("heading", { name: /chat coming soon/i })).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<ChatPopup />);
    expect(screen.getByText(/direct messages between friends are on the roadmap/i)).toBeInTheDocument();
  });

  it("renders the MessageSquare icon", () => {
    render(<ChatPopup />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("has no input field", () => {
    render(<ChatPopup />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows Russian strings in ru locale", async () => {
    const i18n = await import("../../../i18n/index");
    await i18n.default.changeLanguage("ru");
    render(<ChatPopup />);
    expect(screen.getByRole("heading", { name: /чат скоро появится/i })).toBeInTheDocument();
    await i18n.default.changeLanguage("en");
  });
});
