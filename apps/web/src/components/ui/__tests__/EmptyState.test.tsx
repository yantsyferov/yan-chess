import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Users } from "lucide-react";
import { EmptyState } from "../EmptyState";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("EmptyState", () => {
  it("renders title when provided", () => {
    renderWithRouter(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    renderWithRouter(<EmptyState description="No items to show" />);
    expect(screen.getByText("No items to show")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = renderWithRouter(<EmptyState icon={Users} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("fires onClick when action button is clicked", async () => {
    const handler = vi.fn();
    renderWithRouter(<EmptyState actions={[{ label: "Go", onClick: handler }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders action with to prop inside a Link", () => {
    renderWithRouter(<EmptyState actions={[{ label: "Friends", to: "/friends" }]} />);
    const link = screen.getByRole("link", { name: "Friends" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/friends");
  });
});
