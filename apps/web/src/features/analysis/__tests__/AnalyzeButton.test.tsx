// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n/index";
import { AnalyzeButton } from "../AnalyzeButton";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("AnalyzeButton", () => {
  it("navigates to /analysis/<gameId> when kind is online", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AnalyzeButton gameRef={{ kind: "online", gameId: "abc-123" }} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(mockNavigate).toHaveBeenCalledWith("/analysis/abc-123");
  });

  it("navigates to /analysis/session when kind is session", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AnalyzeButton
          gameRef={{
            kind: "session",
            source: "vs-bot",
            pgn: "1. e4 e5",
            playerColor: "white",
          }}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(mockNavigate).toHaveBeenCalledWith("/analysis/session");
  });
});
