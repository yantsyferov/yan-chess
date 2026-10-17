// @layer: unit
// @spec: 016-component-extraction
// @regression
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToggleGroup } from "../ToggleGroup";

describe("ToggleGroup", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Bravo" },
    { value: "c", label: "Charlie" },
  ] as const;

  it("renders all options as buttons", () => {
    render(<ToggleGroup value="a" onChange={() => {}} options={options} />);
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bravo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Charlie" })).toBeInTheDocument();
  });

  it("marks the active option with aria-pressed=true", () => {
    render(<ToggleGroup value="b" onChange={() => {}} options={options} />);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Bravo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Charlie" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fires onChange with the clicked option's value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleGroup value="a" onChange={onChange} options={options} />);
    await user.click(screen.getByRole("button", { name: "Charlie" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("renders a label when passed", () => {
    render(<ToggleGroup value="a" onChange={() => {}} options={options} label="Choose one" />);
    expect(screen.getByText("Choose one")).toBeInTheDocument();
  });

  it("does not fire onChange for disabled options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const opts = [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Bravo", disabled: true },
    ];
    render(<ToggleGroup value="a" onChange={onChange} options={opts} />);
    await user.click(screen.getByRole("button", { name: "Bravo" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports boolean values (rated/casual toggle)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const boolOpts = [
      { value: true, label: "Rated" },
      { value: false, label: "Casual" },
    ];
    render(<ToggleGroup value={true} onChange={onChange} options={boolOpts} />);
    expect(screen.getByRole("button", { name: "Rated" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Casual" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("segment variant applies bordered styling", () => {
    render(<ToggleGroup value="a" onChange={() => {}} options={options} variant="segment" />);
    const activeBtn = screen.getByRole("button", { name: "Alpha" });
    expect(activeBtn.className).toContain("border");
  });

  it("grid layout applies grid-cols class", () => {
    const { container } = render(
      <ToggleGroup value="a" onChange={() => {}} options={options} layout="grid" gridCols={3} />,
    );
    const group = container.querySelector('[role="group"]');
    expect(group?.className).toContain("grid-cols-3");
  });
});
