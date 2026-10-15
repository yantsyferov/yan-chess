// @layer: integration
// @spec: 002-visual-design-foundation
// @regression

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mock authService to avoid network calls
vi.mock("../../src/features/auth/authService", () => ({
  register: vi.fn(),
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

import { Register } from "../../src/pages/Register";
import * as authService from "../../src/features/auth/authService";

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

describe("Register page integration", () => {
  describe("empty form submission shows validation errors", () => {
    // @regression
    it("shows email validation error on empty submit", async () => {
      const user = userEvent.setup();
      renderRegister();
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
      });
    });

    // @regression
    it("shows nickname validation error on empty submit", async () => {
      const user = userEvent.setup();
      renderRegister();
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        expect(
          screen.getByText(
            "Nickname can contain 3–20 Latin letters, digits, and underscores",
          ),
        ).toBeInTheDocument();
      });
    });

    // @regression
    it("shows password validation error on empty submit", async () => {
      const user = userEvent.setup();
      renderRegister();
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        expect(
          screen.getByText(
            "Password must be at least 8 characters and contain at least one letter and one digit",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("successful registration navigates to verify-email/check", () => {
    // @regression
    it("calls navigate on 201 response", async () => {
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
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/verify-email/check",
          expect.objectContaining({ replace: true }),
        );
      });
    });
  });

  describe("409 email_taken shows field error and login link", () => {
    // @regression
    it("shows email-taken error message on 409 conflict", async () => {
      const user = userEvent.setup();
      vi.mocked(authService.register).mockResolvedValue({
        status: 409,
        ok: false,
        body: { field: "email", code: "email_taken" },
      });
      renderRegister();
      await user.type(screen.getByLabelText("Email"), "taken@example.com");
      await user.type(screen.getByLabelText("Nickname"), "alice123");
      await user.type(screen.getByLabelText("Password"), "Password1");
      await user.type(screen.getByLabelText("Confirm password"), "Password1");
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        expect(screen.getByText("This email is already registered")).toBeInTheDocument();
      });
    });

    // @regression
    it("shows link to /login when email is taken", async () => {
      const user = userEvent.setup();
      vi.mocked(authService.register).mockResolvedValue({
        status: 409,
        ok: false,
        body: { field: "email", code: "email_taken" },
      });
      renderRegister();
      await user.type(screen.getByLabelText("Email"), "taken@example.com");
      await user.type(screen.getByLabelText("Nickname"), "alice123");
      await user.type(screen.getByLabelText("Password"), "Password1");
      await user.type(screen.getByLabelText("Confirm password"), "Password1");
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        const loginLinks = screen.getAllByRole("link", { name: "Sign in" });
        // Should be at least one link pointing to /login
        const hasLoginLink = loginLinks.some((el) => el.getAttribute("href") === "/login");
        expect(hasLoginLink).toBe(true);
      });
    });
  });

  describe("network error handling (negative)", () => {
    // @regression
    it("shows network error message when register throws", async () => {
      const user = userEvent.setup();
      vi.mocked(authService.register).mockRejectedValue(new Error("Network error"));
      renderRegister();
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.type(screen.getByLabelText("Nickname"), "alice123");
      await user.type(screen.getByLabelText("Password"), "Password1");
      await user.type(screen.getByLabelText("Confirm password"), "Password1");
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await waitFor(() => {
        expect(
          screen.getByText("Network error. Please try again."),
        ).toBeInTheDocument();
      });
    });
  });
});
