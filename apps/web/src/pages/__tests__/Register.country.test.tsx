// @layer: unit
// @spec: 015-sidebar-popups-profile-country

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "../../i18n/index";

// Mock authService to avoid network calls
vi.mock("../../features/auth/authService", () => ({
  register: vi.fn(),
}));

// Mock CountryPicker with a simple select to allow programmatic interaction
vi.mock("../../features/profile/CountryPicker", () => ({
  CountryPicker: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (code: string) => void;
  }) => (
    <select
      aria-label="Country"
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
    >
      <option value="">Select country</option>
      <option value="MX">Mexico</option>
      <option value="US">United States</option>
    </select>
  ),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { Register } from "../Register";
import * as authService from "../../features/auth/authService";

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  vi.mocked(authService.register).mockClear();
});

describe("Register — Country field", () => {
  it("renders CountryPicker below confirm-password field", () => {
    renderRegister();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
  });

  it("Submit button is disabled when country is not selected", () => {
    renderRegister();
    const submitBtn = screen.getByRole("button", { name: "Sign up" });
    expect(submitBtn).toBeDisabled();
  });

  it("Submit button becomes enabled after selecting a country", async () => {
    const user = userEvent.setup();
    renderRegister();
    const submitBtn = screen.getByRole("button", { name: "Sign up" });
    expect(submitBtn).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Country"), "MX");
    expect(submitBtn).toBeEnabled();
  });

  it("calls authService.register with country code when form is submitted", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.register).mockResolvedValue({
      status: 201,
      ok: true,
      body: { status: "verification_sent" },
    });
    renderRegister();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Nickname"), "alice123");
    await user.type(screen.getByLabelText("Password"), "Password1");
    await user.type(screen.getByLabelText("Confirm password"), "Password1");
    await user.selectOptions(screen.getByLabelText("Country"), "MX");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => {
      expect(vi.mocked(authService.register)).toHaveBeenCalledWith(
        expect.objectContaining({ country: "MX" }),
      );
    });
  });
});
