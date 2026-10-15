import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "./guards/jwt-auth.guard";

@Injectable()
export class TokenVerifierService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies an HS256-signed access token and validates the pwdEpoch claim
   * against the user's current passwordUpdatedAt.
   *
   * Throws UnauthorizedException on any failure:
   *   - missing / malformed secret
   *   - invalid signature, expired token
   *   - user not found
   *   - pwdEpoch mismatch (token issued before a password reset)
   */
  async verifyAccessToken(rawToken: string): Promise<{ sub: string; nickname: string; pwdEpoch: string }> {
    const secret = process.env["JWT_ACCESS_SECRET"];
    if (!secret) throw new UnauthorizedException();

    let payload: JwtPayload;
    try {
      payload = jwt.verify(rawToken, secret, { algorithms: ["HS256"], clockTolerance: 5 }) as JwtPayload;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { passwordUpdatedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.passwordUpdatedAt.toISOString() !== payload.pwdEpoch) throw new UnauthorizedException();

    return { sub: payload.sub, nickname: payload.nickname, pwdEpoch: payload.pwdEpoch };
  }
}
