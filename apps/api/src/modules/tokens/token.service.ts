import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

export type TokenKind = "verify" | "reset";

export class TokenInvalidError extends Error {
  constructor(public readonly reason: "token_invalid" | "token_expired" | "token_used") {
    super(reason);
    this.name = "TokenInvalidError";
  }
}

@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, kind: TokenKind, ttlSec: number): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    const tokenHash = sha256(raw);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    if (kind === "verify") {
      await this.prisma.emailVerificationToken.create({
        data: { tokenHash, userId, expiresAt },
      });
    } else {
      await this.prisma.passwordResetToken.create({
        data: { tokenHash, userId, expiresAt },
      });
    }

    return raw;
  }

  async consume(kind: TokenKind, raw: string): Promise<{ userId: string }> {
    const tokenHash = sha256(raw);

    if (kind === "verify") {
      const row = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
      if (!row) throw new TokenInvalidError("token_invalid");
      if (row.usedAt) throw new TokenInvalidError("token_used");
      if (row.expiresAt.getTime() <= Date.now()) throw new TokenInvalidError("token_expired");
      await this.prisma.emailVerificationToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });
      return { userId: row.userId };
    }

    // kind === "reset"
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row) throw new TokenInvalidError("token_invalid");
    if (row.usedAt) throw new TokenInvalidError("token_used");
    if (row.expiresAt.getTime() <= Date.now()) throw new TokenInvalidError("token_expired");
    await this.prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });
    return { userId: row.userId };
  }
}

function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
