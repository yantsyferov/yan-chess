// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "../../../i18n/index";

import { NotificationsPopup } from "../NotificationsPopup";

describe("NotificationsPopup", () => {
  it("renders the Notifications header", () => {
    render(<NotificationsPopup />);
    expect(screen.getByRole("heading", { name: /notifications/i })).toBeInTheDocument();
  });

  it("renders the empty state text", () => {
    render(<NotificationsPopup />);
    expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it("renders the Bell icon", () => {
    render(<NotificationsPopup />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });
});
