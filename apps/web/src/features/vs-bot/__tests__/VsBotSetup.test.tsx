// @layer: integration
// @spec: 005-play-vs-bot
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VsBotSetup } from "../VsBotSetup";
import { useVsBotStore } from "../useVsBotStore";

function resetStore() {
  const s = useVsBotStore.getState();
  s.newGame();
  s.setLevel("clubPlayer");
  s.setColor("white");
  s.setMode("Blitz");
}

beforeEach(() => {
  resetStore();
});

describe("VsBotSetup rendering", () => {
  it("renders 3 card groups: level, color, time control", () => {
    // @regression
    render(<VsBotSetup engineReady={true} />);
    // 5 level cards
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Amateur")).toBeInTheDocument();
    expect(screen.getByText("Club Player")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
    // 3 color options
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Black")).toBeInTheDocument();
    expect(screen.getByText("Random")).toBeInTheDocument();
    // 4 time control options — mode labels from MODE_LABELS
    expect(screen.getByText("Bullet")).toBeInTheDocument();
    expect(screen.getByText("Blitz")).toBeInTheDocument();
    expect(screen.getByText("Rapid")).toBeInTheDocument();
    expect(screen.getByText("Classical")).toBeInTheDocument();
  });

  it("'Start game' button is disabled when engineReady=false", () => {
    // @regression
    render(<VsBotSetup engineReady={false} />);
    const btn = screen.getByRole("button", { name: /start game/i });
    expect(btn).toBeDisabled();
  });

  it("'Start game' button is enabled when engineReady=true", () => {
    // @regression
    render(<VsBotSetup engineReady={true} />);
    const btn = screen.getByRole("button", { name: /start game/i });
    expect(btn).not.toBeDisabled();
  });

  it("defaults: Club Player level is highlighted (aria-pressed=true)", () => {
    render(<VsBotSetup engineReady={true} />);
    const clubBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Club Player"),
    );
    expect(clubBtn).toBeDefined();
    expect(clubBtn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("defaults: White color is highlighted", () => {
    render(<VsBotSetup engineReady={true} />);
    const whiteBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("White"),
    );
    expect(whiteBtn?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("VsBotSetup interactions", () => {
  it("clicking 'Start game' calls store.startGame and transitions phase to playing", () => {
    // @regression
    render(<VsBotSetup engineReady={true} />);
    const btn = screen.getByRole("button", { name: /start game/i });
    fireEvent.click(btn);
    expect(useVsBotStore.getState().phase).toBe("playing");
  });

  it("clicking 'Expert' level card sets level=expert and highlights it", () => {
    // @regression
    render(<VsBotSetup engineReady={true} />);
    const expertBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Expert"),
    );
    expect(expertBtn).toBeDefined();
    fireEvent.click(expertBtn!);
    expect(useVsBotStore.getState().setup.level).toBe("expert");
    expect(expertBtn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking 'Random' sets color=random in store", () => {
    render(<VsBotSetup engineReady={true} />);
    const randomBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Random"),
    );
    fireEvent.click(randomBtn!);
    expect(useVsBotStore.getState().setup.color).toBe("random");
  });

  it("negative: 'Start game' does nothing when engineReady=false", () => {
    render(<VsBotSetup engineReady={false} />);
    const btn = screen.getByRole("button", { name: /start game/i });
    fireEvent.click(btn);
    // Phase stays setup since button is disabled
    expect(useVsBotStore.getState().phase).toBe("setup");
  });
});
