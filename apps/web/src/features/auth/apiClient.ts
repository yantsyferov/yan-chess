import { useAuthStore } from "./useAuthStore";

const API_BASE = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000/api/v1";

export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  body: T;
}

async function doFetch<T>(path: string, init: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, init);
  let parsed: unknown = null;
  const text = await res.text();
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
  return { status: res.status, ok: res.ok, body: parsed as T };
}

// Single-flight refresh — if a 401 happens while another refresh is in flight,
// callers await the same promise.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { accessToken: string };
      return body.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Public auth endpoints — a 401 here is a semantic answer (bad credentials, expired/used token),
// not a session-expiry signal. Skip refresh/redirect for them so the UI can render the error.
const PUBLIC_AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/email/verify",
  "/auth/email/resend",
  "/auth/password/forgot",
  "/auth/password/reset",
];

export async function authedFetch<T>(path: string, init: RequestInit, retrying = false): Promise<ApiResponse<T>> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  const res = await doFetch<T>(path, { ...init, headers, credentials: "include" });

  const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}?`));

  if (res.status === 401 && !retrying && !isPublicAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const { user } = useAuthStore.getState();
      if (user) useAuthStore.getState().setSession(newToken, user);
      return authedFetch(path, init, true);
    }
    // Refresh failed → clear and redirect.
    useAuthStore.getState().clear();
    if (typeof window !== "undefined") window.location.href = "/login";
    return res;
  }
  return res;
}

export function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  return authedFetch<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return authedFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  return authedFetch<T>(path, { method: "DELETE" });
}
