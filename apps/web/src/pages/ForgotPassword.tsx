import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@yanchess/shared";
import type { ForgotPasswordInput } from "@yanchess/shared";
import { useTranslation } from "react-i18next";
import { translateZodMessage } from "../lib/zodErrorMap";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { AuthLayout } from "../components/ui/AuthLayout";
import * as authService from "../features/auth/authService";

export function ForgotPassword(): JSX.Element {
  const { t } = useTranslation("auth");
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await authService.forgotPassword(data);
    } catch {
      /* always show the same success message on any outcome */
    }
    setSubmitted(true);
  });

  if (submitted) {
    return (
      <AuthLayout
        title={t("forgotPassword.sentTitle")}
        footer={
          <Link to="/login" className="text-accent hover:underline">
            {t("forgotPassword.backToSignIn")}
          </Link>
        }
      >
        <p className="text-text-secondary">
          {t("forgotPassword.sentBody")}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("forgotPassword.title")}
      footer={
        <Link to="/login" className="text-accent hover:underline">
          {t("forgotPassword.backToSignIn")}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t("forgotPassword.email")}
          type="email"
          {...register("email")}
          error={translateZodMessage(errors.email?.message)}
        />
        <Button type="submit" isLoading={isSubmitting}>
          {t("forgotPassword.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
