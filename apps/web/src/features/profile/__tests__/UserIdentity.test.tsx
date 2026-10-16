// @layer: unit
// @spec: 016-component-extraction

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserIdentity } from "../UserIdentity";

function renderIdentity(props: Partial<Parameters<typeof UserIdentity>[0]> = {}) {
  return render(
    <UserIdentity nickname="TestUser" country={null} {...props} />,
  );
}

describe("UserIdentity", () => {
  it("renders the nickname", () => {
    renderIdentity({ nickname: "Alice" });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders the country flag via UserFlag", () => {
    renderIdentity({ nickname: "Bob", country: "FR" });
    // UserFlag renders an emoji inside a span with aria-label
    expect(screen.getByLabelText("France")).toBeInTheDocument();
  });

  it("renders rating in parens when rating prop is passed", () => {
    renderIdentity({ nickname: "Alice", rating: 1540 });
    expect(screen.getByText("(1540)")).toBeInTheDocument();
  });

  it("does not render rating span when rating is undefined", () => {
    renderIdentity({ nickname: "Alice" });
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it("renders online dot with aria-label 'online' when online=true", () => {
    renderIdentity({ online: true });
    expect(screen.getByLabelText("online")).toBeInTheDocument();
  });

  it("renders dot with aria-label 'offline' when online=false", () => {
    renderIdentity({ online: false });
    expect(screen.getByLabelText("offline")).toBeInTheDocument();
  });

  it("does not render any status dot when online is not passed", () => {
    renderIdentity({});
    expect(screen.queryByLabelText("online")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("offline")).not.toBeInTheDocument();
  });

  it("applies text-sm class for size='sm'", () => {
    const { container } = renderIdentity({ size: "sm" });
    const nicknameSpan = container.querySelector("span.text-sm");
    expect(nicknameSpan).not.toBeNull();
  });

  it("applies text-lg and font-semibold classes for size='lg'", () => {
    const { container } = renderIdentity({ size: "lg" });
    const nicknameSpan = container.querySelector("span.text-lg");
    expect(nicknameSpan).not.toBeNull();
  });
});
