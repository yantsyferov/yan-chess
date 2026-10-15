import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@yanchess/shared";
import type { ForgotPasswordInput } from "@yanchess/shared";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { AuthLayout } from "../components/ui/AuthLayout";
import * as authService from "../features/auth/authService";

export function ForgotPassword(): JSX.Element {
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
        title="Check your email"
        footer={
          <Link to="/login" className="text-accent hover:underline">
            ← Back to sign in
          </Link>
        }
      >
        <p className="text-text-secondary">
          If this email is registered, we've sent a password reset link to it. The link is valid for 1 hour.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password?"
      footer={
        <Link to="/login" className="text-accent hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
