// @layer: integration
// @spec: 005-play-vs-bot
// @regression

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameActions } from "../GameActions";

const noop = vi.fn();

describe("GameActions showDrawOffer regression", () => {
  it("showDrawOffer=false: resign button IS rendered, draw button is NOT", () => {
    // @regression
    render(
      <GameActions
        canAct={true}
        onResignClick={noop}
        onOfferDraw={noop}
        showDrawOffer={false}
      />,
    );
    expect(screen.getByRole("button", { name: /resign/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /offer draw/i }),
    ).not.toBeInTheDocument();
  });

  it("showDrawOffer=true (default): both resign and draw buttons render", () => {
    // @regression
    render(
      <GameActions canAct={true} onResignClick={noop} onOfferDraw={noop} />,
    );
    expect(screen.getByRole("button", { name: /resign/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /offer draw/i }),
    ).toBeInTheDocument();
  });

  it("showDrawOffer=undefined (default): both buttons render (hotseat / online)", () => {
    render(
      <GameActions canAct={true} onResignClick={noop} onOfferDraw={noop} />,
    );
    expect(screen.getByRole("button", { name: /offer draw/i })).toBeInTheDocument();
  });

  it("negative: canAct=false renders nothing", () => {
    const { container } = render(
      <GameActions canAct={false} onResignClick={noop} onOfferDraw={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
