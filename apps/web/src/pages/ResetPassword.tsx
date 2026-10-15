import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { resetPasswordSchema } from "@yanchess/shared";
import type { ResetPasswordInput } from "@yanchess/shared";
import { useTranslation } from "react-i18next";
import { translateZodMessage } from "../lib/zodErrorMap";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Button } from "../components/ui/Button";
import { AuthLayout } from "../components/ui/AuthLayout";
import * as authService from "../features/auth/authService";

type ResetState = "form" | "success" | "invalid";

export function ResetPassword(): JSX.Element {
  const { t } = useTranslation("auth");
  const [search] = useSearchParams();
  const token = search.get("token") ?? "";
  const [state, setState] = useState<ResetState>(token ? "form" : "invalid");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: "", confirmNewPassword: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    const res = await authService.resetPassword({ ...data, token });
    if (res.status === 200) {
      setState("success");
    } else if (res.status === 410) {
      setState("invalid");
    }
  });

  if (state === "success") {
    return (
      <AuthLayout title={t("resetPassword.successTitle")}>
        <Link to="/login" className="text-accent hover:text-accent-hover underline">
          {t("resetPassword.successSignIn")}
        </Link>
      </AuthLayout>
    );
  }

  if (state === "invalid") {
    return (
      <AuthLayout title={t("resetPassword.invalidTitle")}>
        <Link
          to="/forgot-password"
          className="text-accent hover:text-accent-hover underline"
        >
          {t("resetPassword.invalidAction")}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("resetPassword.title")}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <input type="hidden" {...register("token")} value={token} />
        <PasswordInput
          label={t("resetPassword.newPassword")}
          {...register("newPassword")}
          error={translateZodMessage(errors.newPassword?.message)}
        />
        <PasswordInput
          label={t("resetPassword.confirmNewPassword")}
          {...register("confirmNewPassword")}
          error={translateZodMessage(errors.confirmNewPassword?.message)}
        />
        <Button type="submit" isLoading={isSubmitting}>
          {t("resetPassword.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
