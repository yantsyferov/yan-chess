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
import type { Mode } from "@yanchess/shared";
import { WsException } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { WsJwtGuard } from "../auth/guards/ws-jwt.guard";
import { TokenVerifierService } from "../auth/token-verifier.service";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { WsExceptionFilter } from "./filters/ws-exception.filter";
import { GameService } from "./game.service";
import type { GameColor } from "./game.service";
import { RedisService } from "../redis/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { PresenceService } from "../realtime/presence.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";

export interface GameSnapshotPayload {
  gameId: string;
  fen: string;
  movesSan: string[];
  clocks: { whiteMs: number; blackMs: number };
  sideToMove: GameColor;
  color: GameColor;
  opponent: { nickname: string; rating: number; online: boolean };
  mode: Mode;
  timeControlMs: number;
  serverNow: number;
  lastMove: { from: string; to: string } | null;
}

export interface OpponentOnlinePayload {
  gameId: string;
  color: GameColor;
  online: boolean;
}

@WebSocketGateway({
  namespace: "play",
  cors: {
    origin: process.env["WEB_URL"] ?? "http://localhost:5173",
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
@UseFilters(WsExceptionFilter)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly tokenVerifier: TokenVerifierService,
    private readonly matchmakingService: MatchmakingService,
    private readonly gameService: GameService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  afterInit(): void {
    this.realtime.register("play", this.server);
  }

  async handleConnection(client: Socket): Promise<void> {
    // WsJwtGuard runs on message events, not on connection — authenticate manually here
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

      // Re-join active game room if the user has an ongoing game
      const activeGameId = await this.redisService.get(`user:activeGame:${payload.sub}`);
      if (activeGameId) {
        await client.join(`game:${activeGameId}`);

        // Emit game.opponentOnline only if this is the first socket for this user (0→1 transition)
        const userSockets = await this.server.in(`user:${payload.sub}`).fetchSockets();
        if (userSockets.length === 1) {
          const gameHash = await this.redisService.hgetall(`game:${activeGameId}`);
          if (gameHash["status"] === "active") {
            const userColor: GameColor = gameHash["whiteUserId"] === payload.sub ? "white" : "black";
            const onlinePayload: OpponentOnlinePayload = { gameId: activeGameId, color: userColor, online: true };
            this.server.to(`game:${activeGameId}`).emit("game.opponentOnline", onlinePayload);
          }
        }
      }

      this.logger.log(
        `socket connected userId=${payload.sub} nickname=${payload.nickname}`,
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
    this.logger.log(`socket disconnected userId=${userId ?? "unknown"}`);
    if (userId !== undefined) {
      void this.matchmakingService.leaveQueue(userId);
      void this.handleDisconnectOnlineStatus(client, userId);
      void this.handlePresenceOnDisconnect(userId);
    }
  }

  private async handlePresenceOnDisconnect(userId: string): Promise<void> {
    const count = await this.presenceService.getSocketCount(userId);
    if (count === 0) {
      await this.presenceService.broadcastPresence(userId, false);
    }
  }

  private async handleDisconnectOnlineStatus(client: Socket, userId: string): Promise<void> {
    const activeGameId = await this.redisService.get(`user:activeGame:${userId}`);
    if (!activeGameId) return;

    const gameHash = await this.redisService.hgetall(`game:${activeGameId}`);
    if (gameHash["status"] !== "active") return;

    // fetchSockets after disconnect — Socket.IO has already removed the socket from rooms
    // Filter out the current socket to be safe in case of race conditions
    const userSockets = await this.server.in(`user:${userId}`).fetchSockets();
    const remainingSockets = userSockets.filter((s) => s.id !== client.id);
    if (remainingSockets.length === 0) {
      const userColor: GameColor = gameHash["whiteUserId"] === userId ? "white" : "black";
      const onlinePayload: OpponentOnlinePayload = { gameId: activeGameId, color: userColor, online: false };
      this.server.to(`game:${activeGameId}`).emit("game.opponentOnline", onlinePayload);
    }
  }

  @SubscribeMessage("hello")
  async handleHello(
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data["userId"] as string | undefined;
    if (userId === undefined) return;

    const entry = await this.matchmakingService.getQueueEntry(userId);
    if (entry !== null) {
      this.server.to(`user:${userId}`).emit("queue.joined", { mode: entry.mode, since: entry.since });
    }

    // Hydrate a reconnecting tab with the current game state
    const activeGameId = await this.redisService.get(`user:activeGame:${userId}`);
    if (activeGameId) {
      const snapshot = await this.buildGameSnapshot(userId, activeGameId);
      if (snapshot !== null) {
        client.emit("game.snapshot", snapshot);
      }
    }
  }

  private async buildGameSnapshot(userId: string, gameId: string): Promise<GameSnapshotPayload | null> {
    const gameHash = await this.redisService.hgetall(`game:${gameId}`);
    if (!gameHash || gameHash["status"] !== "active") return null;

    const userColor: GameColor = gameHash["whiteUserId"] === userId ? "white" : "black";
    const opponentId: string = userColor === "white" ? gameHash["blackUserId"]! : gameHash["whiteUserId"]!;
    const opponentRatingKey = userColor === "white" ? "blackRatingBefore" : "whiteRatingBefore";
    const opponentRating = parseInt(gameHash[opponentRatingKey] ?? "1500", 10);

    const opponentUser = await this.prismaService.user.findUnique({
      where: { id: opponentId },
      select: { nickname: true },
    });
    const opponentNickname = opponentUser?.nickname ?? opponentId;

    const opponentSockets = await this.server.in(`user:${opponentId}`).fetchSockets();
    const opponentOnline = opponentSockets.length > 0;

    const movesSan: string[] = await this.redisService.raw.lrange(`game:${gameId}:moves`, 0, -1);

    const storedWhiteMs = parseInt(gameHash["whiteClockMs"] ?? "0", 10);
    const storedBlackMs = parseInt(gameHash["blackClockMs"] ?? "0", 10);
    const lastMoveAt = parseInt(gameHash["lastMoveAt"] ?? "0", 10);
    const sideToMove: GameColor = (gameHash["sideToMove"] as GameColor | undefined) ?? "white";
    const mode = gameHash["mode"] as Mode;
    const timeControlMs = parseInt(gameHash["timeControlMs"] ?? "0", 10);

    // The hash stores clocks as of the last move; the active side has been
    // ticking since lastMoveAt. Subtract elapsed from the active side so the
    // client receives the current remaining time (not the last-move snapshot).
    const now = Date.now();
    const elapsed = Math.max(0, now - lastMoveAt);
    const whiteMs =
      sideToMove === "white" ? Math.max(0, storedWhiteMs - elapsed) : storedWhiteMs;
    const blackMs =
      sideToMove === "black" ? Math.max(0, storedBlackMs - elapsed) : storedBlackMs;

    const snapshot: GameSnapshotPayload = {
      gameId,
      fen: gameHash["fen"] ?? "",
      movesSan,
      clocks: { whiteMs, blackMs },
      sideToMove,
      color: userColor,
      opponent: { nickname: opponentNickname, rating: opponentRating, online: opponentOnline },
      mode,
      timeControlMs,
      serverNow: now,
      lastMove: null,
    };

    return snapshot;
  }

  @SubscribeMessage("queue.join")
  async handleQueueJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { mode: unknown },
  ): Promise<void> {
    const userId: string = client.data["userId"] as string;
    const nickname: string = client.data["nickname"] as string;
    const mode = this.validateMode(body?.mode);
    const { since } = await this.matchmakingService.joinQueue(userId, nickname, mode);
    this.server.to(`user:${userId}`).emit("queue.joined", { mode, since });
  }

  @SubscribeMessage("queue.leave")
  async handleQueueLeave(
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId: string = client.data["userId"] as string;
    await this.matchmakingService.leaveQueue(userId);
    this.server.to(`user:${userId}`).emit("queue.left", {});
  }

  @SubscribeMessage("game.move")
  async handleGameMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; from: string; to: string; promotion?: string },
  ): Promise<void> {
    const userId = client.data["userId"] as string;
    const outcome = await this.gameService.applyMove(userId, body.gameId, {
      from: body.from,
      to: body.to,
      promotion: body.promotion,
    });
    if (!outcome.ok) {
      client.emit("game.moveRejected", { gameId: body.gameId, reason: outcome.reason });
      return;
    }
    this.server.to(`game:${body.gameId}`).emit("game.state", outcome.broadcast);
    if ("endsGame" in outcome && outcome.endsGame) {
      // Slice 6/8 will emit game.end with full payload; for now, no action.
    }
  }

  @SubscribeMessage("game.resign")
  async handleGameResign(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string },
  ): Promise<void> {
    await this.gameService.resign(client.data["userId"] as string, body.gameId);
  }

  @SubscribeMessage("game.offerDraw")
  async handleGameOfferDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string },
  ): Promise<void> {
    const r = await this.gameService.offerDraw(client.data["userId"] as string, body.gameId);
    if (!r.ok) {
      if (r.reason === "draw_offer_cooldown") {
        client.emit("game.actionRejected", { gameId: body.gameId, reason: r.reason, remainingMoves: r.remainingMoves });
      } else {
        client.emit("game.actionRejected", { gameId: body.gameId, reason: r.reason });
      }
    }
  }

  @SubscribeMessage("game.respondDraw")
  async handleGameRespondDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string; accept: boolean },
  ): Promise<void> {
    const r = await this.gameService.respondDraw(client.data["userId"] as string, body.gameId, body.accept);
    if (!r.ok) {
      client.emit("game.actionRejected", { gameId: body.gameId, reason: r.reason });
    }
  }

  @SubscribeMessage("game.offerRematch")
  async handleGameOfferRematch(@ConnectedSocket() client: Socket, @MessageBody() body: { gameId: string }): Promise<void> {
    const r = await this.gameService.offerRematch(client.data["userId"] as string, body.gameId);
    if (!r.ok) {
      client.emit("game.actionRejected", { gameId: body.gameId, reason: r.reason });
    }
  }

  @SubscribeMessage("game.respondRematch")
  async handleGameRespondRematch(@ConnectedSocket() client: Socket, @MessageBody() body: { gameId: string; accept: boolean }): Promise<void> {
    const r = await this.gameService.respondRematch(client.data["userId"] as string, body.gameId, body.accept);
    if (!r.ok) {
      client.emit("game.actionRejected", { gameId: body.gameId, reason: r.reason });
    }
  }

  private validateMode(mode: unknown): Mode {
    const valid: Mode[] = ["Bullet", "Blitz", "Rapid", "Classical"];
    if (typeof mode === "string" && (valid as string[]).includes(mode)) {
      return mode as Mode;
    }
    throw new WsException({ code: "INVALID_MODE", message: `mode must be one of ${valid.join(", ")}` });
  }
}
