import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { TokenVerifierService } from "../token-verifier.service";

export interface JwtPayload {
  sub: string;
  nickname: string;
  pwdEpoch: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenVerifier: TokenVerifierService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: JwtPayload }>();
    const auth = req.headers.authorization ?? "";
    const match = /^Bearer (.+)$/.exec(auth);
    if (!match) throw new UnauthorizedException();

    // Delegate signature verification and pwdEpoch check to TokenVerifierService.
    const payload = await this.tokenVerifier.verifyAccessToken(match[1]);

    req.user = payload as JwtPayload;
    return true;
  }
}
