// @layer: integration
// @spec: 005-play-vs-bot
// @regression

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VsBotResultModal } from "../VsBotResultModal";

const noop = vi.fn();

describe("VsBotResultModal — perspective-aware titles", () => {
  it("player won by checkmate: 'You won. Checkmate.'", () => {
    // @regression
    render(
      <VsBotResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={false}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    expect(screen.getByText("You won. Checkmate.")).toBeInTheDocument();
  });

  it("player lost by flag: 'You lost. Flag.'", () => {
    // @regression
    render(
      <VsBotResultModal
        result={{ winner: "black", reason: "flag_fall" }}
        resultModalDismissed={false}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    expect(screen.getByText("You lost. Flag.")).toBeInTheDocument();
  });

  it("stalemate draw: 'Draw. Stalemate.'", () => {
    // @regression
    render(
      <VsBotResultModal
        result={{ winner: "draw", reason: "stalemate" }}
        resultModalDismissed={false}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    expect(screen.getByText("Draw. Stalemate.")).toBeInTheDocument();
  });

  it("resignation: title reads 'You resigned. Bot wins.'", () => {
    // @regression
    render(
      <VsBotResultModal
        result={{ winner: "black", reason: "resignation" }}
        resultModalDismissed={false}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    expect(screen.getByText("You resigned. Bot wins.")).toBeInTheDocument();
  });

  it("shows three buttons: Rematch, New game, Close", () => {
    // @regression
    render(
      <VsBotResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={false}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /rematch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("negative: modal is not visible when resultModalDismissed=true", () => {
    render(
      <VsBotResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={true}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    // When dismissed the Dialog open=false — title should not be in DOM
    expect(screen.queryByText("You won. Checkmate.")).not.toBeInTheDocument();
  });

  it("does NOT show a rating delta line (spec §2.8)", () => {
    render(
      <VsBotResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={false}
        playerColor="white"
        onDismiss={noop}
        onNewGame={noop}
        onRematch={noop}
      />,
    );
    expect(screen.queryByText(/rating/i)).not.toBeInTheDocument();
  });
});
