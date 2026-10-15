// @layer: unit
// @spec: 011-production-deployment
// @regression
//
// Verifies that auth.controller.ts reads COOKIE_SAMESITE from env and passes the
// correct sameSite value to res.cookie() on login.
//
// Strategy: build a minimal NestJS test module, supply mock AuthService that returns a
// well-known LoginResult, supply a mock Response spy, invoke controller.login(), and
// assert the sameSite option forwarded to res.cookie().

import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test } from "@nestjs/testing";
import { AuthController } from "../../src/modules/auth/auth.controller.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";

// Minimal mock AuthService — only login() matters here.
const mockLoginResult = {
  accessToken: "access-tok",
  refreshJti: "jti-abc",
  refreshTtlSec: 3600,
  user: {
    id: "user-1",
    nickname: "tester",
    email: "test@example.com",
    createdAt: new Date(),
  },
};

const mockAuthService = {
  login: vi.fn().mockResolvedValue(mockLoginResult),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerifyEmail: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
};

/** Build a minimal mock Response object with a cookie spy. */
function buildMockResponse() {
  return { cookie: vi.fn() } as unknown as import("express").Response;
}

describe("AuthController — cookie sameSite env", () => {
  const originalEnv = { ...process.env };
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sameSite=none when COOKIE_SAMESITE=none", async () => {
    // @regression
    process.env["COOKIE_SAMESITE"] = "none";
    const res = buildMockResponse();
    await controller.login({ email: "a@b.c", password: "pass", remember: false }, res);
    expect(res.cookie).toHaveBeenCalledOnce();
    const opts = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(opts.sameSite).toBe("none");
  });

  it("sameSite=lax when COOKIE_SAMESITE=lax", async () => {
    // @regression
    process.env["COOKIE_SAMESITE"] = "lax";
    const res = buildMockResponse();
    await controller.login({ email: "a@b.c", password: "pass", remember: false }, res);
    const opts = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(opts.sameSite).toBe("lax");
  });

  it("sameSite defaults to lax when COOKIE_SAMESITE is unset", async () => {
    // @regression
    delete process.env["COOKIE_SAMESITE"];
    const res = buildMockResponse();
    await controller.login({ email: "a@b.c", password: "pass", remember: false }, res);
    const opts = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    expect(opts.sameSite).toBe("lax");
  });
});
