// @layer: integration
// @spec: 012-i18n
// @regression

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n/index";

// Auth pages use react-router-dom hooks — mock navigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// authService calls network — stub it out
vi.mock("../features/auth/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  resendVerifyEmail: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
}));

import { Login } from "../pages/Login";
import { Register } from "../pages/Register";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("ru");
  });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("Login — Russian labels", () => {
  it("renders form labels in Russian", () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    expect(screen.getByLabelText("Запомнить меня")).toBeInTheDocument();
    expect(screen.getByText("Забыли пароль?")).toBeInTheDocument();
  });

  it("shows Russian Zod validation error when form submitted empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    const submitBtn = screen.getByRole("button", { name: "Войти" });
    await user.click(submitBtn);
    const errors = await screen.findAllByText("Введите email");
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("Register — Russian labels", () => {
  it("renders form labels in Russian", () => {
    renderWithProviders(<Register />);
    expect(screen.getByText("Регистрация")).toBeInTheDocument();
    expect(screen.getByLabelText("Никнейм")).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    expect(screen.getByLabelText("Подтвердите пароль")).toBeInTheDocument();
  });

  it("shows Russian Zod validation error when form submitted empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    const submitBtn = screen.getByRole("button", { name: "Зарегистрироваться" });
    await user.click(submitBtn);
    const errors = await screen.findAllByText("Введите email");
    expect(errors.length).toBeGreaterThan(0);
  });
});
