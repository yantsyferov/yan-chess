// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvalBar } from "../EvalBar";

describe("EvalBar", () => {
  it("renders numeric eval +1.3 for evaluationCp=130 and white fill > 50%", () => {
    render(<EvalBar evaluationCp={130} mateIn={null} boardHeight={400} />);
    expect(screen.getByText("+1.3")).toBeTruthy();
    // White portion must be > 50% for a positive eval
    const whiteFill = screen.getByTestId("eval-bar-white");
    const heightPct = parseFloat(whiteFill.style.height);
    // For cp=130: tanh(130/400) ≈ 0.314 → whitePercent ≈ 65.7%
    expect(heightPct).toBeGreaterThan(62);
  });

  it("renders M5 label and mate indicator when mateIn=5", () => {
    render(<EvalBar evaluationCp={null} mateIn={5} boardHeight={400} />);
    // Label at top
    expect(screen.getAllByText("M5").length).toBeGreaterThanOrEqual(1);
    // White bar fills fully
    const whiteFill = screen.getByTestId("eval-bar-white");
    expect(whiteFill.style.height).toBe("100%");
    // Mate indicator visible inside bar
    expect(screen.getByTestId("eval-bar-mate-indicator")).toBeTruthy();
  });

  it("renders striped pending pattern when both evaluationCp and mateIn are null", () => {
    render(<EvalBar evaluationCp={null} mateIn={null} boardHeight={400} />);
    expect(screen.getByTestId("eval-bar-pending")).toBeTruthy();
    // Should NOT render white/black split divs
    expect(screen.queryByTestId("eval-bar-white")).toBeNull();
    expect(screen.queryByTestId("eval-bar-black")).toBeNull();
  });
});
