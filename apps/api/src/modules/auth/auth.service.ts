import { Injectable, ConflictException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import * as jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { RegisterInput, LoginInput } from "@yanchess/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "../tokens/token.service";
import { MailService } from "../mail/mail.service";
import { RedisService } from "../redis/redis.service";
import { UsersService } from "../users/users.service";
import { RateLimiterService } from "../rate-limiter/rate-limiter.service";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB — OWASP 2023 Minimum
  timeCost: 2,
  parallelism: 1,
};

const JWT_ACCESS_TTL_SEC = Number(process.env["JWT_ACCESS_TTL_SEC"] ?? 900);
const REFRESH_TTL_SEC_REMEMBER = Number(process.env["REFRESH_TTL_SEC_REMEMBER"] ?? 2592000);
const REFRESH_TTL_SEC_SESSION = Number(process.env["REFRESH_TTL_SEC_SESSION"] ?? 86400);

// Lazy-init dummy hash for timing equalization when email is unknown.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash("dummy-password-for-timing-only", ARGON2_OPTIONS);
  return dummyHashPromise;
}

export class ResendThrottledError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super("throttled");
    this.name = "ResendThrottledError";
  }
}

export class LoginUnverifiedError extends Error {
  constructor() {
    super("email_not_verified");
    this.name = "LoginUnverifiedError";
  }
}

export class LoginInvalidCredentialsError extends Error {
  constructor() {
    super("invalid_credentials");
    this.name = "LoginInvalidCredentialsError";
  }
}

export class LoginLockedError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super("locked");
    this.name = "LoginLockedError";
  }
}

export interface LoginSuccess {
  accessToken: string;
  refreshJti: string;
  refreshTtlSec: number;
  user: { id: string; nickname: string; email: string; createdAt: Date };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
    private readonly usersService: UsersService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  private get jwtSecret(): string {
    const s = process.env["JWT_ACCESS_SECRET"];
    if (!s) throw new Error("JWT_ACCESS_SECRET not set");
    return s;
  }

  async register(dto: RegisterInput): Promise<void> {
    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);

    let user: { id: string; email: string };
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email, // already .trim().toLowerCase() by the schema
          nickname: dto.nickname,
          nicknameNormalized: dto.nickname.toLowerCase(),
          passwordHash,
          lang: dto.lang ?? null,
        },
        select: { id: true, email: true },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = Array.isArray(e.meta?.["target"]) ? (e.meta["target"] as string[]) : [];
        if (target.includes("email")) {
          throw new ConflictException({ field: "email", code: "email_taken" });
        }
        if (target.includes("nickname_normalized")) {
          throw new ConflictException({ field: "nickname", code: "nickname_taken" });
        }
      }
      throw e;
    }

    const rawToken = await this.tokenService.issue(user.id, "verify", 24 * 60 * 60);
    const webUrl = process.env["WEB_URL"] ?? "http://localhost:5173";
    const link = `${webUrl}/verify-email?token=${rawToken}`;

    try {
      await this.mailService.send({
        to: user.email,
        subject: "Confirm your YanChess registration",
        html: `<p>Click the button below to confirm your registration.</p><p><a href="${link}">Confirm email</a></p>`,
        token: rawToken,
      });
    } catch (e: unknown) {
      this.logger.error(`Failed to send verify email to ${user.email}`, e);
    }
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const { userId } = await this.tokenService.consume("verify", rawToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async login(dto: LoginInput): Promise<LoginSuccess> {
    const email = dto.email; // already normalized by loginSchema (trim + toLowerCase)
    const gateKey = `rl:login:fail:${email}`;

    const existingCountStr = await this.redis.get(gateKey);
    const existingCount = existingCountStr ? parseInt(existingCountStr, 10) : 0;
    if (existingCount >= 5) {
      const ttl = await this.redis.ttl(gateKey);
      // Timing equalization: burn one argon2 hash so timing matches real failures
      await argon2.verify(await getDummyHash(), "dummy-password-for-timing-only").catch(() => {});
      throw new LoginLockedError(ttl > 0 ? ttl : 900);
    }

    const bumpFailureCount = async (): Promise<void> => {
      const count = await this.redis.incr(gateKey);
      if (count === 1) await this.redis.expire(gateKey, 900);
    };

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nickname: true,
        passwordHash: true,
        emailVerifiedAt: true,
        createdAt: true,
        passwordUpdatedAt: true,
      },
    });

    if (!user) {
      // Timing equalization: burn same CPU as a real verify
      await argon2.verify(await getDummyHash(), dto.password);
      await bumpFailureCount();
      throw new LoginInvalidCredentialsError();
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await bumpFailureCount();
      throw new LoginInvalidCredentialsError();
    }

    if (user.emailVerifiedAt === null) {
      throw new LoginUnverifiedError();
    }

    await this.prisma.$transaction(async (tx) => {
      await this.usersService.ensureStartingRatings(user.id, tx);
    });

    const accessToken = jwt.sign(
      {
        sub: user.id,
        nickname: user.nickname,
        pwdEpoch: user.passwordUpdatedAt.toISOString(),
      },
      this.jwtSecret,
      { algorithm: "HS256", expiresIn: JWT_ACCESS_TTL_SEC },
    );

    const jti = randomUUID();
    const ttl = dto.rememberMe ? REFRESH_TTL_SEC_REMEMBER : REFRESH_TTL_SEC_SESSION;

    await this.redis.hset(`session:${jti}`, {
      userId: user.id,
      rememberMe: dto.rememberMe ? "1" : "0",
      createdAt: new Date().toISOString(),
    });
    await this.redis.expire(`session:${jti}`, ttl);
    await this.redis.sadd(`user:sessions:${user.id}`, jti);
    await this.redis.expire(`user:sessions:${user.id}`, REFRESH_TTL_SEC_REMEMBER);

    return {
      accessToken,
      refreshJti: jti,
      refreshTtlSec: ttl,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  async refresh(oldJti: string): Promise<LoginSuccess> {
    const key = `session:${oldJti}`;
    const data = await this.redis.hgetall(key);
    if (!data["userId"]) throw new LoginInvalidCredentialsError();

    const userId = data["userId"];
    const rememberMe = data["rememberMe"] === "1";
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new LoginInvalidCredentialsError();

    const newJti = randomUUID();
    const ttl = rememberMe ? REFRESH_TTL_SEC_REMEMBER : REFRESH_TTL_SEC_SESSION;

    const pipe = this.redis.pipeline();
    pipe.del(key);
    pipe.srem(`user:sessions:${userId}`, oldJti);
    pipe.hset(`session:${newJti}`, { userId, rememberMe: rememberMe ? "1" : "0", createdAt: new Date().toISOString() });
    pipe.expire(`session:${newJti}`, ttl);
    pipe.sadd(`user:sessions:${userId}`, newJti);
    pipe.expire(`user:sessions:${userId}`, REFRESH_TTL_SEC_REMEMBER);
    await pipe.exec();

    const accessToken = jwt.sign(
      { sub: user.id, nickname: user.nickname, pwdEpoch: user.passwordUpdatedAt.toISOString() },
      this.jwtSecret,
      { algorithm: "HS256", expiresIn: JWT_ACCESS_TTL_SEC },
    );

    return {
      accessToken,
      refreshJti: newJti,
      refreshTtlSec: ttl,
      user: { id: user.id, nickname: user.nickname, email: user.email, createdAt: user.createdAt },
    };
  }

  async logout(jti: string): Promise<void> {
    const data = await this.redis.hgetall(`session:${jti}`);
    if (!data["userId"]) return; // idempotent: no-op if session already gone
    const pipe = this.redis.pipeline();
    pipe.del(`session:${jti}`);
    pipe.srem(`user:sessions:${data["userId"]}`, jti);
    await pipe.exec();
  }

  async forgotPassword(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    // Rate-limit regardless of existence to not leak existence via timing/429.
    const gate = await this.rateLimiter.check(`rl:resend:reset:${normalized}`, 60, 1);
    if (!gate.allowed) {
      // Silent swallow — same-shape response per spec. Do NOT throw here.
      this.logger.warn(`Password reset throttled for ${normalized}`);
      return;
    }
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) return; // same-shape silent success

    const rawToken = await this.tokenService.issue(user.id, "reset", 60 * 60); // 1h
    const link = `${process.env["WEB_URL"] ?? "http://localhost:5173"}/reset-password?token=${rawToken}`;
    try {
      await this.mailService.send({
        to: user.email,
        subject: "Reset your YanChess password",
        html: `<p>Click the button below to reset your password.</p><p><a href="${link}">Reset password</a></p>`,
        token: rawToken,
      });
    } catch (e: unknown) {
      this.logger.error(`Failed to send reset email to ${user.email}`, e);
    }
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { userId } = await this.tokenService.consume("reset", rawToken);
    const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordUpdatedAt: new Date() },
    });

    // Kill all sessions: SMEMBERS → DEL each session:<jti> → DEL set.
    const setKey = `user:sessions:${userId}`;
    const jtis = await this.redis.smembers(setKey);
    if (jtis.length > 0) {
      const pipe = this.redis.pipeline();
      for (const jti of jtis) pipe.del(`session:${jti}`);
      pipe.del(setKey);
      await pipe.exec();
    }
  }

  async resendVerifyEmail(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) return;
    if (user.emailVerifiedAt) return;

    const gate = await this.rateLimiter.check(`rl:resend:verify:${user.id}`, 60, 1);
    if (!gate.allowed) throw new ResendThrottledError(gate.retryAfterSec);

    const rawToken = await this.tokenService.issue(user.id, "verify", 24 * 60 * 60);
    const link = `${process.env["WEB_URL"] ?? "http://localhost:5173"}/verify-email?token=${rawToken}`;
    try {
      await this.mailService.send({
        to: user.email,
        subject: "Confirm your YanChess registration",
        html: `<p>Click the button below to confirm your registration.</p><p><a href="${link}">Confirm email</a></p>`,
        token: rawToken,
      });
    } catch (e: unknown) {
      this.logger.error(`Failed to resend verify email to ${user.email}`, e);
    }
  }
}
