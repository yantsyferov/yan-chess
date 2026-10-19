// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "../../../i18n/index";
import { MoveQualityTiles } from "../MoveQualityTiles";

describe("MoveQualityTiles", () => {
  it("shows spinner and analyzing text when status is running", () => {
    render(<MoveQualityTiles status="running" buckets={null} />);
    expect(screen.getByText("Analyzing…")).toBeTruthy();
  });

  it("shows not available message when status is error", () => {
    render(<MoveQualityTiles status="error" buckets={null} />);
    expect(screen.getByText("Analysis not available.")).toBeTruthy();
  });

  it("renders three tiles with correct counts when status is done with buckets", () => {
    const buckets = { standout: 5, normal: 13, mistake: 6 };
    render(<MoveQualityTiles status="done" buckets={buckets} />);
    // Each count should be rendered
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("13")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    // Labels
    expect(screen.getByText("Standout")).toBeTruthy();
    expect(screen.getByText("Normal")).toBeTruthy();
    expect(screen.getByText("Mistake")).toBeTruthy();
  });

  it("renders two rows for White and Black when perSideBuckets is provided", () => {
    const perSideBuckets = {
      white: { standout: 3, normal: 7, mistake: 2 },
      black: { standout: 1, normal: 9, mistake: 4 },
    };
    render(
      <MoveQualityTiles status="done" buckets={null} perSideBuckets={perSideBuckets} />,
    );
    expect(screen.getByText("White:")).toBeTruthy();
    expect(screen.getByText("Black:")).toBeTruthy();
    // White row counts
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});
