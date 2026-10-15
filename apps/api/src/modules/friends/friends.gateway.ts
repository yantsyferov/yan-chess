import {
  Logger,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { WsJwtGuard } from "../auth/guards/ws-jwt.guard";
import { TokenVerifierService } from "../auth/token-verifier.service";
import { WsExceptionFilter } from "../game/filters/ws-exception.filter";
import { PresenceService } from "../realtime/presence.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";
import { ChallengeService } from "./challenge.service";
import type {
  ChallengeSendPayload,
  ChallengeRespondPayload,
  ChallengeCancelPayload,
} from "@yanchess/shared";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const ModeSchema = z.enum(["Bullet", "Blitz", "Rapid", "Classical"]);
const ChallengeColorSchema = z.enum(["white", "black", "random"]);

const ChallengeSendSchema = z.object({
  targetUserId: z.string().uuid(),
  mode: ModeSchema,
  color: ChallengeColorSchema,
});

const ChallengeRespondSchema = z.object({
  challengeId: z.string().uuid(),
  accept: z.boolean(),
});

const ChallengeCancelSchema = z.object({
  challengeId: z.string().uuid(),
});

@WebSocketGateway({
  namespace: "friends",
  cors: {
    origin: process.env["WEB_URL"] ?? "http://localhost:5173",
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
@UseFilters(WsExceptionFilter)
export class FriendsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(FriendsGateway.name);

  constructor(
    private readonly tokenVerifier: TokenVerifierService,
    private readonly presenceService: PresenceService,
    private readonly challengeService: ChallengeService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  afterInit(): void {
    this.realtime.register("friends", this.server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.["token"] as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
      const payload = await this.tokenVerifier.verifyAccessToken(raw);
      client.data["userId"] = payload.sub;
      client.data["nickname"] = payload.nickname;
      await client.join(`user:${payload.sub}`);
      this.logger.log(
        `[friends] socket connected userId=${payload.sub} nickname=${payload.nickname}`,
      );

      const count = await this.presenceService.getSocketCount(payload.sub);
      if (count === 1) {
        await this.presenceService.broadcastPresence(payload.sub, true);
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data["userId"] as string | undefined;
    this.logger.log(`[friends] socket disconnected userId=${userId ?? "unknown"}`);
    if (userId !== undefined) {
      void this.handlePresenceOnDisconnect(userId);
    }
  }

  private async handlePresenceOnDisconnect(userId: string): Promise<void> {
    const count = await this.presenceService.getSocketCount(userId);
    if (count === 0) {
      await this.presenceService.broadcastPresence(userId, false);
    }
  }

  @SubscribeMessage("hello")
  handleHello(@ConnectedSocket() _client: Socket): { ok: true } {
    // Room is already joined on connect — nothing extra needed.
    return { ok: true };
  }

  @SubscribeMessage("challenge.send")
  async handleChallengeSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChallengeSendPayload,
  ): Promise<{ ok: true } | { ok: false; code: string }> {
    const parsed = ChallengeSendSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, code: "invalid_payload" };
    }

    const myUserId = client.data["userId"] as string;
    const myNickname = client.data["nickname"] as string;

    const result = await this.challengeService.sendChallenge(myUserId, myNickname, parsed.data);

    if (result.ok && result.challengeId !== undefined && result.timeoutAt !== undefined) {
      client.emit("challenge.sent", {
        challengeId: result.challengeId,
        targetUserId: parsed.data.targetUserId,
        expiresAt: result.timeoutAt,
      });
    }

    return result.ok ? { ok: true } : result;
  }

  @SubscribeMessage("challenge.respond")
  async handleChallengeRespond(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChallengeRespondPayload,
  ): Promise<{ ok: true } | { ok: false; code: string }> {
    const parsed = ChallengeRespondSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, code: "invalid_payload" };
    }

    const myUserId = client.data["userId"] as string;
    return this.challengeService.respondChallenge(myUserId, parsed.data.challengeId, parsed.data.accept);
  }

  @SubscribeMessage("challenge.cancel")
  async handleChallengeCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChallengeCancelPayload,
  ): Promise<{ ok: true } | { ok: false; code: string }> {
    const parsed = ChallengeCancelSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, code: "invalid_payload" };
    }

    const myUserId = client.data["userId"] as string;
    return this.challengeService.cancelChallenge(myUserId, parsed.data.challengeId);
  }
}
