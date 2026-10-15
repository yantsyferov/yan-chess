import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UsePipes,
  HttpException,
  Res,
  Req,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, type RegisterInput, type LoginInput } from "@yanchess/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService, LoginUnverifiedError, LoginInvalidCredentialsError, LoginLockedError, ResendThrottledError } from "./auth.service";
import { TokenInvalidError } from "../tokens/token.service";

const verifyEmailSchema = z.object({ token: z.string().min(1) });
const resendEmailSchema = z.object({ email: z.string().email() });

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() dto: RegisterInput): Promise<{ status: "verification_sent" }> {
    await this.authService.register(dto);
    return { status: "verification_sent" };
  }

  @Post("email/resend")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(resendEmailSchema))
  async resendEmail(@Body() dto: { email: string }): Promise<{ status: "verification_sent" }> {
    try {
      await this.authService.resendVerifyEmail(dto.email);
      return { status: "verification_sent" };
    } catch (e: unknown) {
      if (e instanceof ResendThrottledError) {
        throw new HttpException({ code: "throttled", retryAfterSec: e.retryAfterSec }, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw e;
    }
  }

  @Post("email/verify")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  async verifyEmail(@Body() dto: { token: string }): Promise<{ status: "verified" }> {
    try {
      await this.authService.verifyEmail(dto.token);
      return { status: "verified" };
    } catch (e: unknown) {
      if (e instanceof TokenInvalidError) {
        throw new HttpException({ code: e.reason }, HttpStatus.GONE);
      }
      throw e;
    }
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() dto: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: string; nickname: string; email: string; createdAt: Date } }> {
    try {
      const result = await this.authService.login(dto);
      res.cookie("refresh", result.refreshJti, {
        httpOnly: true,
        secure: process.env["COOKIE_SECURE"] === "true",
        sameSite: (process.env["COOKIE_SAMESITE"] ?? "lax").toLowerCase() as "lax" | "strict" | "none",
        path: "/api/v1/auth",
        maxAge: result.refreshTtlSec * 1000,
      });
      return { accessToken: result.accessToken, user: result.user };
    } catch (e: unknown) {
      if (e instanceof LoginLockedError) {
        throw new HttpException({ code: "locked", retryAfterSec: e.retryAfterSec }, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (e instanceof LoginUnverifiedError) {
        throw new HttpException({ code: "email_not_verified" }, HttpStatus.FORBIDDEN);
      }
      if (e instanceof LoginInvalidCredentialsError) {
        throw new HttpException({ code: "invalid_credentials" }, HttpStatus.UNAUTHORIZED);
      }
      throw e;
    }
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const jti = (req.cookies as Record<string, string | undefined>)["refresh"];
    if (!jti) throw new HttpException({ code: "no_refresh" }, HttpStatus.UNAUTHORIZED);
    try {
      const result = await this.authService.refresh(jti);
      res.cookie("refresh", result.refreshJti, {
        httpOnly: true,
        secure: process.env["COOKIE_SECURE"] === "true",
        sameSite: (process.env["COOKIE_SAMESITE"] ?? "lax").toLowerCase() as "lax" | "strict" | "none",
        path: "/api/v1/auth",
        maxAge: result.refreshTtlSec * 1000,
      });
      return { accessToken: result.accessToken };
    } catch {
      throw new HttpException({ code: "invalid_refresh" }, HttpStatus.UNAUTHORIZED);
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const jti = (req.cookies as Record<string, string | undefined>)["refresh"];
    if (jti) await this.authService.logout(jti);
    res.clearCookie("refresh", { path: "/api/v1/auth" });
  }

  @Post("password/forgot")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() dto: { email: string }): Promise<{ status: "reset_email_sent" }> {
    await this.authService.forgotPassword(dto.email);
    return { status: "reset_email_sent" };
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(
    @Body() dto: { token: string; newPassword: string; confirmNewPassword: string },
  ): Promise<{ status: "password_updated" }> {
    try {
      await this.authService.resetPassword(dto.token, dto.newPassword);
      return { status: "password_updated" };
    } catch (e: unknown) {
      if (e instanceof TokenInvalidError) {
        throw new HttpException({ code: e.reason }, HttpStatus.GONE);
      }
      throw e;
    }
  }
}
