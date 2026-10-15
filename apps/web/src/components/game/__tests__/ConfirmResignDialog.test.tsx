// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmResignDialog } from "../ConfirmResignDialog";
import { useGameStore } from "../../../features/game/useGameStore";

vi.stubGlobal("performance", { now: () => 0 });

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("ConfirmResignDialog", () => {
  it("shows 'Resign as white?' when activeColor=white", () => {
    // @regression
    render(
      <ConfirmResignDialog
        open={true}
        activeColor="white"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Resign as white?")).toBeInTheDocument();
  });

  it("shows 'Resign as black?' when activeColor=black", () => {
    // @regression
    render(
      <ConfirmResignDialog
        open={true}
        activeColor="black"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Resign as black?")).toBeInTheDocument();
  });

  it("'Resign' button calls onConfirm", () => {
    // @regression
    const onConfirm = vi.fn();
    render(
      <ConfirmResignDialog
        open={true}
        activeColor="white"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /resign/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("'Cancel' calls onCancel", () => {
    // @regression
    const onCancel = vi.fn();
    render(
      <ConfirmResignDialog
        open={true}
        activeColor="white"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
