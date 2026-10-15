// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DrawOfferDialog } from "../DrawOfferDialog";
import { useGameStore } from "../../../features/game/useGameStore";

vi.stubGlobal("performance", { now: () => 0 });

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("DrawOfferDialog", () => {
  it("shows 'Black offers a draw.' when pending.from=black", () => {
    // @regression
    render(
      <DrawOfferDialog
        pending={{ from: "black" }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText("Black offers a draw.")).toBeInTheDocument();
  });

  it("shows 'White offers a draw.' when pending.from=white", () => {
    // @regression
    render(
      <DrawOfferDialog
        pending={{ from: "white" }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText("White offers a draw.")).toBeInTheDocument();
  });

  it("'Accept' calls onRespond(true)", () => {
    // @regression
    const onRespond = vi.fn();
    render(
      <DrawOfferDialog
        pending={{ from: "black" }}
        onRespond={onRespond}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onRespond).toHaveBeenCalledWith(true);
  });

  it("'Decline' calls onRespond(false)", () => {
    // @regression
    const onRespond = vi.fn();
    render(
      <DrawOfferDialog
        pending={{ from: "black" }}
        onRespond={onRespond}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(onRespond).toHaveBeenCalledWith(false);
  });
});
