import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  Lang,
} from "@yanchess/shared";
import { apiPost, type ApiResponse } from "./apiClient";
import { useAuthStore, type AuthUser } from "./useAuthStore";
import { useLangStore } from "../i18n/useLangStore";
import { disconnectSocket } from "../online/socket";
import { disconnectFriendsSocket } from "../friends/friends-socket";
import { resetFriendsStore } from "../friends/useFriendsStore";

export interface RegisterSuccessResponse {
  status: "verification_sent";
}

/** Actual 409 body from the API: flat object, no statusCode wrapper. */
export interface RegisterConflictResponse {
  field: "email" | "nickname";
  code: "email_taken" | "nickname_taken";
}

export function register(
  input: RegisterInput,
): Promise<ApiResponse<RegisterSuccessResponse | RegisterConflictResponse>> {
  return apiPost<RegisterSuccessResponse | RegisterConflictResponse>(
    "/auth/register",
    input,
  );
}

export interface VerifyEmailSuccessResponse {
  status: "verified";
}

export interface VerifyEmailFailureResponse {
  code: "token_expired" | "token_used" | "token_invalid";
}

export function verifyEmail(
  token: string,
): Promise<ApiResponse<VerifyEmailSuccessResponse | VerifyEmailFailureResponse>> {
  return apiPost<VerifyEmailSuccessResponse | VerifyEmailFailureResponse>(
    "/auth/email/verify",
    { token },
  );
}

export interface LoginSuccessResponse {
  accessToken: string;
  user: AuthUser;
}

export interface LoginErrorResponse {
  code: "invalid_credentials" | "email_not_verified" | "locked";
  retryAfterSec?: number;
}

export async function login(input: LoginInput): Promise<{ status: number; body: LoginSuccessResponse | LoginErrorResponse }> {
  const res = await apiPost<LoginSuccessResponse | LoginErrorResponse>("/auth/login", input);
  if (res.status === 200) {
    const ok = res.body as LoginSuccessResponse;
    useAuthStore.getState().setSession(ok.accessToken, ok.user);
  }
  return { status: res.status, body: res.body };
}

export interface ResendSuccessResponse {
  status: "verification_sent";
}

export interface ResendThrottledResponse {
  code: "throttled";
  retryAfterSec: number;
}

export function resendVerifyEmail(
  email: string,
): Promise<ApiResponse<ResendSuccessResponse | ResendThrottledResponse>> {
  return apiPost<ResendSuccessResponse | ResendThrottledResponse>(
    "/auth/email/resend",
    { email },
  );
}

export async function logout(): Promise<void> {
  await apiPost("/auth/logout");
  useAuthStore.getState().clear();
  disconnectSocket();
  disconnectFriendsSocket();
  resetFriendsStore();
}

export interface ForgotPasswordSuccessResponse {
  status: "reset_email_sent";
}

export interface ResetPasswordSuccessResponse {
  status: "password_updated";
}

export interface ResetPasswordFailureResponse {
  code: "token_expired" | "token_used" | "token_invalid";
}

export function forgotPassword(
  input: ForgotPasswordInput,
): Promise<ApiResponse<ForgotPasswordSuccessResponse>> {
  return apiPost<ForgotPasswordSuccessResponse>("/auth/password/forgot", input);
}

export function resetPassword(
  input: ResetPasswordInput,
): Promise<ApiResponse<ResetPasswordSuccessResponse | ResetPasswordFailureResponse>> {
  return apiPost<ResetPasswordSuccessResponse | ResetPasswordFailureResponse>(
    "/auth/password/reset",
    input,
  );
}

/**
 * Resolve the current user session without triggering the apiClient's
 * 401 → `window.location.href = "/login"` fallback. Used by ProtectedRoute
 * on mount: a null return means the caller should Navigate with its own
 * location state (so banners like "Sign in to play online" are preserved).
 */
export async function fetchMe(): Promise<AuthUser | null> {
  const API_BASE =
    (import.meta.env["VITE_API_URL"] as string | undefined) ??
    "http://localhost:3000/api/v1";

  async function callMe(token: string | null): Promise<Response> {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}/users/me`, { credentials: "include", headers });
  }

  async function tryRefresh(): Promise<string | null> {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!r.ok) return null;
    const body = (await r.json()) as { accessToken: string };
    return body.accessToken;
  }

  let token = useAuthStore.getState().accessToken;
  let res = await callMe(token);

  if (res.status === 401) {
    const fresh = await tryRefresh();
    if (!fresh) {
      useAuthStore.getState().clear();
      return null;
    }
    token = fresh;
    const prev = useAuthStore.getState().user;
    if (prev) useAuthStore.getState().setSession(fresh, prev);
    res = await callMe(fresh);
  }

  if (res.status !== 200) {
    useAuthStore.getState().clear();
    return null;
  }

  const u = (await res.json()) as {
    id: string;
    nickname: string;
    email: string;
    createdAt: string;
    avatar: null;
    lang: Lang | null;
    ratings: import("./useAuthStore").Rating[];
  };
  const user: AuthUser = {
    id: u.id,
    nickname: u.nickname,
    email: u.email,
    createdAt: u.createdAt,
    ratings: u.ratings,
  };
  if (token) useAuthStore.getState().setSession(token, user);
  if (u.lang !== null && u.lang !== undefined) {
    useLangStore.getState().setLang(u.lang, { skipPatch: true });
  }
  return user;
}
