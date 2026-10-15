import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@yanchess/shared";
import type { RegisterInput } from "@yanchess/shared";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { AuthLayout } from "../components/ui/AuthLayout";
import * as authService from "../features/auth/authService";
import type { RegisterConflictResponse } from "../features/auth/authService";

export function Register(): JSX.Element {
  const navigate = useNavigate();
  const [topError, setTopError] = useState<string | null>(null);
  const [showEmailTakenLoginLink, setShowEmailTakenLoginLink] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", nickname: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    setTopError(null);
    setShowEmailTakenLoginLink(false);

    let response;
    try {
      response = await authService.register(data);
    } catch {
      setTopError("Network error. Please try again.");
      return;
    }

    if (response.status === 201) {
      navigate("/verify-email/check", { state: { email: data.email }, replace: true });
      return;
    }

    if (response.status === 409) {
      const conflict = response.body as RegisterConflictResponse;
      if (conflict.code === "email_taken") {
        setError("email", { message: "This email is already registered" });
        setShowEmailTakenLoginLink(true);
      } else if (conflict.code === "nickname_taken") {
        setError("nickname", { message: "This nickname is already taken" });
      }
      return;
    }

    setTopError("Something went wrong. Please try again later.");
  });

  return (
    <AuthLayout
      title="Sign up"
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Already have an account? Sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {topError && <Alert tone="danger">{topError}</Alert>}
        {showEmailTakenLoginLink && (
          <Alert tone="info">
            This email is already registered.{" "}
            <Link to="/login" className="text-accent underline">
              Sign in
            </Link>
          </Alert>
        )}
        <Input
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Input
          label="Nickname"
          {...register("nickname")}
          error={errors.nickname?.message}
        />
        <PasswordInput
          label="Password"
          {...register("password")}
          error={errors.password?.message}
        />
        <PasswordInput
          label="Confirm password"
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Sign up
        </Button>
      </form>
    </AuthLayout>
  );
}
