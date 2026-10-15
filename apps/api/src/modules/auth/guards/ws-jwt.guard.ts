import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { TokenVerifierService } from "../token-verifier.service";

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly tokenVerifier: TokenVerifierService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const client: Socket = ctx.switchToWs().getClient<Socket>();
    const raw: string | undefined = client.handshake?.auth?.token as string | undefined;
    if (!raw) throw new WsException("UNAUTHORIZED");

    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

    try {
      const payload = await this.tokenVerifier.verifyAccessToken(token);
      client.data["userId"] = payload.sub;
      client.data["nickname"] = payload.nickname;
      return true;
    } catch {
      throw new WsException("UNAUTHORIZED");
    }
  }
}
