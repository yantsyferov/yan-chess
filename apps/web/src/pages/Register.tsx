import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@yanchess/shared";
import type { RegisterInput } from "@yanchess/shared";
import { useTranslation } from "react-i18next";
import { translateZodMessage } from "../lib/zodErrorMap";
import { useLangStore } from "../features/i18n/useLangStore";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { AuthLayout } from "../components/ui/AuthLayout";
import { CountryPicker } from "../features/profile/CountryPicker";
import * as authService from "../features/auth/authService";
import type { RegisterConflictResponse } from "../features/auth/authService";

export function Register(): JSX.Element {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [topError, setTopError] = useState<string | null>(null);
  const [showEmailTakenLoginLink, setShowEmailTakenLoginLink] = useState(false);
  const [country, setCountry] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", nickname: "", password: "", confirmPassword: "", country: "" },
  });

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setValue("country", code, { shouldValidate: false });
  };

  const onSubmit = handleSubmit(async (data) => {
    setTopError(null);
    setShowEmailTakenLoginLink(false);

    let response;
    try {
      response = await authService.register({ ...data, lang: useLangStore.getState().current });
    } catch {
      setTopError(t("register.networkError"));
      return;
    }

    if (response.status === 201) {
      navigate("/verify-email/check", { state: { email: data.email }, replace: true });
      return;
    }

    if (response.status === 409) {
      const conflict = response.body as RegisterConflictResponse;
      if (conflict.code === "email_taken") {
        setError("email", { message: t("register.emailTaken") });
        setShowEmailTakenLoginLink(true);
      } else if (conflict.code === "nickname_taken") {
        setError("nickname", { message: t("register.nicknameTaken") });
      }
      return;
    }

    setTopError(t("register.serverError"));
  });

  return (
    <AuthLayout
      title={t("register.title")}
      footer={
        <Link to="/login" className="text-accent hover:underline">
          {t("register.alreadyHaveAccount")} {t("register.signInLink")}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {topError && <Alert tone="danger">{topError}</Alert>}
        {showEmailTakenLoginLink && (
          <Alert tone="info">
            {t("register.emailTaken")}{" "}
            <Link to="/login" className="text-accent underline">
              {t("register.signInToLogin")}
            </Link>
          </Alert>
        )}
        <Input
          label={t("register.email")}
          type="email"
          {...register("email")}
          error={translateZodMessage(errors.email?.message)}
        />
        <Input
          label={t("register.nickname")}
          {...register("nickname")}
          error={translateZodMessage(errors.nickname?.message)}
        />
        <PasswordInput
          label={t("register.password")}
          {...register("password")}
          error={translateZodMessage(errors.password?.message)}
        />
        <PasswordInput
          label={t("register.confirmPassword")}
          {...register("confirmPassword")}
          error={translateZodMessage(errors.confirmPassword?.message)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-primary">
            {t("register.country.label")}
          </label>
          <CountryPicker value={country} onChange={handleCountryChange} />
        </div>
        <Button type="submit" isLoading={isSubmitting} disabled={country === null || isSubmitting}>
          {t("register.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
