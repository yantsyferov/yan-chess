// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalysisProgressView } from "../AnalysisProgressView";

describe("AnalysisProgressView", () => {
  it("renders progress text with done and total counts", () => {
    render(<AnalysisProgressView done={15} total={40} onCancel={vi.fn()} />);
    expect(screen.getByText(/15\s*\/\s*40/)).toBeTruthy();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<AnalysisProgressView done={0} total={10} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
