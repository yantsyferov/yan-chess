import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@yanchess/shared";
import type { LoginInput } from "@yanchess/shared";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { translateZodMessage } from "../lib/zodErrorMap";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Checkbox } from "../components/ui/Checkbox";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { AuthLayout } from "../components/ui/AuthLayout";
import { login, resendVerifyEmail } from "../features/auth/authService";
import type { LoginErrorResponse } from "../features/auth/authService";

interface LocationState {
  message?: string;
  returnTo?: string;
}

export function Login(): JSX.Element {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as LocationState;
  const infoMessage = locationState.message ?? null;
  const returnTo = locationState.returnTo ?? "/";
  const [topError, setTopError] = useState<string | null>(null);
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sent" | string>("idle");

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = handleSubmit(async (data) => {
    setTopError(null);
    setLockoutMessage(null);
    setEmailNotVerified(null);
    setResendState("idle");
    const result = await login(data);
    if (result.status === 200) {
      navigate(returnTo, { replace: true });
      return;
    }
    const body = result.body as LoginErrorResponse;
    if (result.status === 401 && body.code === "invalid_credentials") {
      setError("email", { message: t("login.invalid") });
      setError("password", { message: t("login.invalid") });
      return;
    }
    if (result.status === 403 && body.code === "email_not_verified") {
      setEmailNotVerified(getValues("email"));
      return;
    }
    if (result.status === 429 && body.code === "locked") {
      setLockoutMessage(t("login.lockedOut"));
      return;
    }
    setTopError(t("login.serverError"));
  });

  async function onResend(): Promise<void> {
    if (!emailNotVerified) return;
    const res = await resendVerifyEmail(emailNotVerified);
    if (res.status === 200) {
      setResendState("sent");
    } else if (res.status === 429) {
      const body = res.body as { retryAfterSec?: number };
      setResendState(`throttled:${body.retryAfterSec ?? 60}`);
    }
  }

  return (
    <AuthLayout
      title={t("login.title")}
      footer={
        <Link to="/register" className="text-accent hover:underline">
          {t("login.noAccount")} {t("login.signUpLink")}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {infoMessage !== null && <Alert tone="info">{infoMessage}</Alert>}
        {topError !== null && <Alert tone="danger">{topError}</Alert>}
        {lockoutMessage !== null && <Alert tone="danger">{lockoutMessage}</Alert>}
        {emailNotVerified !== null && (
          <Alert tone="info">
            {t("login.emailNotVerified")} <strong>{emailNotVerified}</strong>{" "}
            or{" "}
            {resendState === "idle" && (
              <button
                type="button"
                onClick={() => {
                  void onResend();
                }}
                className="underline text-accent hover:text-accent-hover"
              >
                {t("login.resendLink")}
              </button>
            )}
            {resendState === "sent" && (
              <span>{t("login.emailSent")}</span>
            )}
            {resendState.startsWith("throttled:") && (
              <span>
                {t("login.emailThrottled", { seconds: resendState.split(":")[1] })}
              </span>
            )}
          </Alert>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label={t("login.email")}
            type="email"
            {...register("email")}
            error={translateZodMessage(errors.email?.message)}
          />
          <PasswordInput
            label={t("login.password")}
            {...register("password")}
            error={translateZodMessage(errors.password?.message)}
          />
          <Checkbox label={t("login.rememberMe")} {...register("rememberMe")} />
          <Link
            to="/forgot-password"
            className="text-accent hover:text-accent-hover text-sm"
          >
            {t("login.forgotPasswordLink")}
          </Link>
          <Button type="submit" isLoading={isSubmitting}>
            {t("login.submit")}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
