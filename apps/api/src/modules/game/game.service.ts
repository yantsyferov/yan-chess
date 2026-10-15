import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Mode } from "@yanchess/shared";
import { GameEndReason as PrismaGameEndReason, GameResult } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RatingService } from "../rating/rating.service";
import { GameRepository } from "./game.repository";
import { ChessRulesService } from "./chess-rules.service";
import { ClockService } from "./clock.service";
import { RealtimeEmitter } from "../realtime/realtime-emitter";

export const TIME_CONTROL_MS: Record<Mode, number> = {
  Bullet: 60_000,
  Blitz: 180_000,
  Rapid: 600_000,
  Classical: 1_800_000,
};

export type GameColor = "white" | "black";

export type GameEndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move"
  | "flag"
  | "flag_vs_insufficient_material"
  | "resignation"
  | "agreement";

export type OfferDrawResult =
  | { ok: true }
  | { ok: false; reason: "draw_offer_cooldown"; remainingMoves: number }
  | { ok: false; reason: "game_already_ended" | "not_participant" };

export type RespondDrawResult =
  | { ok: true }
  | { ok: false; reason: string };

export type OfferRematchResult =
  | { ok: true }
  | { ok: false; reason: string };

export type RespondRematchResult =
  | { ok: true; newGameId?: string }
  | { ok: false; reason: string };

export interface GameStatePayload {
  gameId: string;
  fen: string;
  lastMove: { from: string; to: string };
  san: string;
  clocks: { whiteMs: number; blackMs: number };
  sideToMove: GameColor;
  moveNumber: number;
  serverNow: number;
}

export type ApplyMoveOutcome =
  | { ok: true; broadcast: GameStatePayload }
  | { ok: true; broadcast: GameStatePayload; endsGame: { reason: GameEndReason; winner: GameColor | null } }
  | { ok: false; reason: "game_already_ended" | "not_your_turn" | "illegal_move" };

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface CreatedGame {
  gameId: string;
  mode: Mode;
  timeControlMs: number;
  fen: string;
  sideToMove: "white" | "black";
  serverNow: number;
  startedAt: number;
  white: { userId: string; nickname: string; rating: number };
  black: { userId: string; nickname: string; rating: number };
}

export interface GameEndPayload {
  gameId: string;
  result: "white_win" | "black_win" | "draw";
  endReason: GameEndReason;
  winner: GameColor | null;
  finalFen: string;
  pgn: string | null;
  ratingDeltas: { white: number; black: number } | null;
  ratingsAfter: { white: number; black: number } | null;
}

function isGameEnded(status: string | undefined): boolean {
  return status === "ended" || status === "ended-persisted";
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly chessRules: ChessRulesService,
    private readonly clockService: ClockService,
    private readonly gameRepository: GameRepository,
    private readonly ratingService: RatingService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  async createGame(
    whiteUserId: string,
    blackUserId: string,
    mode: Mode,
  ): Promise<CreatedGame> {
    const gameId = randomUUID();
    const timeControlMs = TIME_CONTROL_MS[mode];

    // Fetch ratings for both users in this mode
    const ratingRows = await this.prisma.ratingByMode.findMany({
      where: { userId: { in: [whiteUserId, blackUserId] }, mode },
    });

    const ratingMap = new Map(ratingRows.map((r) => [r.userId, r.rating]));
    const whiteRatingBefore = ratingMap.get(whiteUserId) ?? 1500;
    const blackRatingBefore = ratingMap.get(blackUserId) ?? 1500;

    // Fetch nicknames
    const users = await this.prisma.user.findMany({
      where: { id: { in: [whiteUserId, blackUserId] } },
      select: { id: true, nickname: true },
    });

    const nicknameMap = new Map(users.map((u) => [u.id, u.nickname]));
    const whiteNickname = nicknameMap.get(whiteUserId) ?? whiteUserId;
    const blackNickname = nicknameMap.get(blackUserId) ?? blackUserId;

    const now = Date.now();
    const fen = STARTING_FEN;

    // Write Redis state atomically via pipeline
    const pipe = this.redis.pipeline();
    pipe.hset(`game:${gameId}`, {
      fen,
      whiteClockMs: timeControlMs,
      blackClockMs: timeControlMs,
      lastMoveAt: now,
      sideToMove: "white",
      whiteUserId,
      blackUserId,
      mode,
      timeControlMs,
      status: "active",
      drawOfferFrom: "",
      whiteDrawOfferLastMoveNumber: "0",
      blackDrawOfferLastMoveNumber: "0",
      startedAt: now,
      whiteRatingBefore,
      blackRatingBefore,
    });
    pipe.sadd("game:active", gameId);
    pipe.set(`user:activeGame:${whiteUserId}`, gameId);
    pipe.set(`user:activeGame:${blackUserId}`, gameId);
    await pipe.exec();

    return {
      gameId,
      mode,
      timeControlMs,
      fen,
      sideToMove: "white",
      serverNow: now,
      startedAt: now,
      white: {
        userId: whiteUserId,
        nickname: whiteNickname,
        rating: whiteRatingBefore,
      },
      black: {
        userId: blackUserId,
        nickname: blackNickname,
        rating: blackRatingBefore,
      },
    };
  }

  async applyMove(
    userId: string,
    gameId: string,
    move: { from: string; to: string; promotion?: string },
  ): Promise<ApplyMoveOutcome> {
    // Step 1: read state from Redis
    const raw = await this.redis.hgetall(`game:${gameId}`);
    if (!raw || Object.keys(raw).length === 0 || isGameEnded(raw["status"])) {
      return { ok: false, reason: "game_already_ended" };
    }

    const whiteUserId = raw["whiteUserId"] ?? "";
    const blackUserId = raw["blackUserId"] ?? "";
    const fen = raw["fen"] ?? "";
    const sideToMove = raw["sideToMove"] as GameColor;
    const lastMoveAt = Number(raw["lastMoveAt"] ?? Date.now());
    const whiteClockMs = Number(raw["whiteClockMs"] ?? 0);
    const blackClockMs = Number(raw["blackClockMs"] ?? 0);

    // Step 2: determine moving player's colour
    const movingColor: GameColor | null =
      userId === whiteUserId ? "white" : userId === blackUserId ? "black" : null;

    if (movingColor === null) {
      return { ok: false, reason: "not_your_turn" };
    }

    // Step 3: check it's this player's turn
    if (movingColor !== sideToMove) {
      return { ok: false, reason: "not_your_turn" };
    }

    // Step 4: tick the clock — check for flag BEFORE applying the move
    const { whiteClockMs: newWhiteMs, blackClockMs: newBlackMs, flagged } =
      this.clockService.tickOnMove({
        whiteClockMs,
        blackClockMs,
        lastMoveAt,
        sideToMove,
      });

    if (flagged !== null) {
      const canMate = this.chessRules.canOpponentMate(fen, flagged);
      const endReason: GameEndReason = canMate ? "flag" : "flag_vs_insufficient_material";
      const winner: GameColor | null = canMate
        ? flagged === "white" ? "black" : "white"
        : null;
      await this.endGame(gameId, { reason: endReason, winner });
      return { ok: false, reason: "game_already_ended" };
    }

    // Step 5: validate and apply the move via chess rules
    const result = this.chessRules.validateAndApply(fen, move);
    if (!result.ok) {
      return { ok: false, reason: "illegal_move" };
    }

    // Step 6: flip sideToMove, set lastMoveAt
    const newSideToMove: GameColor = movingColor === "white" ? "black" : "white";
    const serverNow = Date.now();

    // Step 7: persist to Redis in one pipeline
    const pipe = this.redis.pipeline();

    const hsetFields: Record<string, string | number> = {
      fen: result.fen,
      whiteClockMs: newWhiteMs,
      blackClockMs: newBlackMs,
      lastMoveAt: serverNow,
      sideToMove: newSideToMove,
    };

    if (result.over !== null) {
      hsetFields["status"] = "ended";
    }

    pipe.hset(`game:${gameId}`, hsetFields);
    pipe.rpush(`game:${gameId}:moves`, result.san);
    await pipe.exec();

    // Compute move number = length of moves list after push
    const movesSanRaw = await this.redis.raw.llen(`game:${gameId}:moves`);
    const moveNumber = movesSanRaw;

    // Step 8: build GameStatePayload
    const broadcast: GameStatePayload = {
      gameId,
      fen: result.fen,
      lastMove: result.lastMove,
      san: result.san,
      clocks: { whiteMs: newWhiteMs, blackMs: newBlackMs },
      sideToMove: newSideToMove,
      moveNumber,
      serverNow,
    };

    // Step 9: handle chess-rules game-over
    if (result.over !== null) {
      await this.endGame(gameId, {
        reason: result.over.reason,
        winner: result.over.winner,
      });
      return {
        ok: true,
        broadcast,
        endsGame: {
          reason: result.over.reason,
          winner: result.over.winner,
        },
      };
    }

    return { ok: true, broadcast };
  }

  async resign(userId: string, gameId: string): Promise<void> {
    const raw = await this.redis.hgetall(`game:${gameId}`);
    if (!raw || Object.keys(raw).length === 0 || isGameEnded(raw["status"])) {
      return;
    }

    const whiteUserId = raw["whiteUserId"] ?? "";
    const blackUserId = raw["blackUserId"] ?? "";
    const resignerColor: GameColor = userId === whiteUserId ? "white" : "black";
    const winner: GameColor = resignerColor === "white" ? "black" : "white";

    await this.endGame(gameId, { reason: "resignation", winner });
  }

  async offerDraw(userId: string, gameId: string): Promise<OfferDrawResult> {
    const raw = await this.redis.hgetall(`game:${gameId}`);
    if (!raw || Object.keys(raw).length === 0 || isGameEnded(raw["status"])) {
      return { ok: false, reason: "game_already_ended" };
    }

    const whiteUserId = raw["whiteUserId"] ?? "";
    const blackUserId = raw["blackUserId"] ?? "";

    let color: GameColor;
    if (userId === whiteUserId) {
      color = "white";
    } else if (userId === blackUserId) {
      color = "black";
    } else {
      return { ok: false, reason: "not_participant" };
    }

    const totalHalfMoves = await this.redis.raw.llen(`game:${gameId}:moves`);
    // White moves at indices 0, 2, 4... => ceil(total/2); Black at 1, 3, 5... => floor(total/2)
    const myOwnHalfMovesPlayed =
      color === "white"
        ? Math.ceil(totalHalfMoves / 2)
        : Math.floor(totalHalfMoves / 2);

    const lastOfferKey = color === "white" ? "whiteDrawOfferLastMoveNumber" : "blackDrawOfferLastMoveNumber";
    const lastOfferMoveNumber = Number(raw[lastOfferKey] ?? "0");

    if (lastOfferMoveNumber > 0 && myOwnHalfMovesPlayed - lastOfferMoveNumber < 10) {
      return {
        ok: false,
        reason: "draw_offer_cooldown",
        remainingMoves: 10 - (myOwnHalfMovesPlayed - lastOfferMoveNumber),
      };
    }

    await this.redis.hset(`game:${gameId}`, {
      drawOfferFrom: color,
      [lastOfferKey]: myOwnHalfMovesPlayed,
    });

    this.realtime.toRoom("play", `game:${gameId}`).emit("game.drawOffered", { gameId, byColor: color });

    return { ok: true };
  }

  async respondDraw(userId: string, gameId: string, accept: boolean): Promise<RespondDrawResult> {
    const raw = await this.redis.hgetall(`game:${gameId}`);
    if (!raw || Object.keys(raw).length === 0 || isGameEnded(raw["status"])) {
      return { ok: false, reason: "game_already_ended" };
    }

    const whiteUserId = raw["whiteUserId"] ?? "";
    const blackUserId = raw["blackUserId"] ?? "";

    let color: GameColor;
    if (userId === whiteUserId) {
      color = "white";
    } else if (userId === blackUserId) {
      color = "black";
    } else {
      return { ok: false, reason: "not_participant" };
    }

    const drawOfferFrom = raw["drawOfferFrom"] ?? "";
    if (drawOfferFrom === "" || drawOfferFrom === color) {
      return { ok: false, reason: "no_active_offer" };
    }

    if (accept) {
      await this.endGame(gameId, { reason: "agreement", winner: null });
    } else {
      await this.redis.hset(`game:${gameId}`, { drawOfferFrom: "" });
      this.realtime.toRoom("play", `game:${gameId}`).emit("game.drawDeclined", { gameId });
    }

    return { ok: true };
  }

  async offerRematch(userId: string, previousGameId: string): Promise<OfferRematchResult> {
    const raw = await this.redis.hgetall(`game:${previousGameId}`);
    if (!raw || Object.keys(raw).length === 0) {
      return { ok: false, reason: "game_not_found" };
    }

    const whiteUserId = raw["whiteUserId"] ?? "";
    const blackUserId = raw["blackUserId"] ?? "";

    if (userId !== whiteUserId && userId !== blackUserId) {
      return { ok: false, reason: "game_not_found" };
    }

    const opponentId = userId === whiteUserId ? blackUserId : whiteUserId;

    // Check if there's already an offer from the opponent — treat as simultaneous accept
    const existingOfferer = await this.redis.raw.get(`rematch:offer:${previousGameId}`);
    if (existingOfferer !== null && existingOfferer !== userId) {
      return this.respondRematch(userId, previousGameId, true);
    }

    // Set or overwrite the offer with 30s TTL
    await this.redis.raw.set(`rematch:offer:${previousGameId}`, userId, "EX", 30);

    this.realtime.toUser(opponentId, "play").emit("game.rematchOffered", {
      previousGameId,
      byUserId: userId,
    });

    return { ok: true };
  }

  async respondRematch(userId: string, previousGameId: string, accept: boolean): Promise<RespondRematchResult> {
    const offererUserId = await this.redis.raw.get(`rematch:offer:${previousGameId}`);

    if (offererUserId === null) {
      return { ok: false, reason: "no_active_rematch" };
    }

    if (offererUserId === userId) {
      return { ok: false, reason: "cannot_accept_own_rematch" };
    }

    // Read previous game data
    let whiteUserId: string;
    let blackUserId: string;
    let mode: Mode;

    const raw = await this.redis.hgetall(`game:${previousGameId}`);
    if (raw && Object.keys(raw).length > 0) {
      whiteUserId = raw["whiteUserId"] ?? "";
      blackUserId = raw["blackUserId"] ?? "";
      mode = (raw["mode"] ?? "Blitz") as Mode;
    } else {
      const dbGame = await this.prisma.game.findUnique({ where: { id: previousGameId } });
      if (!dbGame) {
        return { ok: false, reason: "game_not_found" };
      }
      whiteUserId = dbGame.whiteUserId;
      blackUserId = dbGame.blackUserId;
      mode = dbGame.mode as Mode;
    }

    if (accept) {
      // Swap colours
      const newWhiteId = blackUserId;
      const newBlackId = whiteUserId;

      const createdGame = await this.createGame(newWhiteId, newBlackId, mode);
      const { gameId: newGameId, timeControlMs, fen, sideToMove, serverNow } = createdGame;

      await this.realtime.toRoom("play", `user:${newWhiteId}`).socketsJoin(`game:${newGameId}`);
      await this.realtime.toRoom("play", `user:${newBlackId}`).socketsJoin(`game:${newGameId}`);

      this.realtime.toUser(newWhiteId, "play").emit("game.start", {
        gameId: newGameId,
        color: "white",
        opponent: { nickname: createdGame.black.nickname, rating: createdGame.black.rating },
        mode,
        timeControlMs,
        fen,
        clocks: { whiteMs: timeControlMs, blackMs: timeControlMs },
        sideToMove,
        serverNow,
      });

      this.realtime.toUser(newBlackId, "play").emit("game.start", {
        gameId: newGameId,
        color: "black",
        opponent: { nickname: createdGame.white.nickname, rating: createdGame.white.rating },
        mode,
        timeControlMs,
        fen,
        clocks: { whiteMs: timeControlMs, blackMs: timeControlMs },
        sideToMove,
        serverNow,
      });

      await this.redis.raw.del(`rematch:offer:${previousGameId}`);

      return { ok: true, newGameId };
    } else {
      await this.redis.raw.del(`rematch:offer:${previousGameId}`);
      this.realtime.toUser(offererUserId, "play").emit("game.rematchDeclined", {
        previousGameId,
      });
      return { ok: true };
    }
  }

  async endGame(
    gameId: string,
    over: { reason: GameEndReason; winner: GameColor | null },
  ): Promise<void> {
    // Step 1: idempotency guard — check for "ended-persisted" sentinel
    const hash = await this.redis.hgetall(`game:${gameId}`);
    if (!hash || Object.keys(hash).length === 0 || hash["status"] === "ended-persisted") {
      return;
    }

    // Acquire single-use lock to prevent concurrent endGame calls
    const lockId = randomUUID();
    const got = await this.redis.raw.hsetnx(`game:${gameId}`, "endPhaseLockedBy", lockId);
    if (got === 0) {
      // Another caller is already persisting; return idempotently
      return;
    }

    const { reason, winner } = over;
    const result: "white_win" | "black_win" | "draw" =
      winner === "white" ? "white_win" : winner === "black" ? "black_win" : "draw";

    const finalFen = hash["fen"] ?? "";
    const whiteUserId = hash["whiteUserId"] ?? "";
    const blackUserId = hash["blackUserId"] ?? "";
    const mode = (hash["mode"] ?? "Blitz") as Mode;
    const timeControlMs = Number(hash["timeControlMs"] ?? TIME_CONTROL_MS[mode]);
    const whiteRatingBefore = Number(hash["whiteRatingBefore"] ?? 1500);
    const blackRatingBefore = Number(hash["blackRatingBefore"] ?? 1500);
    const startedAt = new Date(Number(hash["startedAt"] ?? Date.now()));
    const endedAt = new Date();

    // Step 2: load SAN move list from Redis
    const moves: string[] = await this.redis.raw.lrange(`game:${gameId}:moves`, 0, -1);

    // Step 3: load user nicknames for PGN headers
    const users = await this.prisma.user.findMany({
      where: { id: { in: [whiteUserId, blackUserId] } },
      select: { id: true, nickname: true },
    });
    const nicknameMap = new Map(users.map((u) => [u.id, u.nickname]));
    const whiteNickname = nicknameMap.get(whiteUserId) ?? whiteUserId;
    const blackNickname = nicknameMap.get(blackUserId) ?? blackUserId;

    // Step 4: build PGN string
    const pgnResult = result === "white_win" ? "1-0" : result === "black_win" ? "0-1" : "1/2-1/2";
    const dateStr = endedAt.toISOString().slice(0, 10).replace(/-/g, ".");
    const moveBody = moves
      .map((san, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${san}` : san))
      .join(" ");
    const pgn = [
      `[White "${whiteNickname}"]`,
      `[Black "${blackNickname}"]`,
      `[Date "${dateStr}"]`,
      `[Result "${pgnResult}"]`,
      `[Mode "${mode}"]`,
      `[TimeControl "${timeControlMs}"]`,
      `[Termination "${reason}"]`,
      "",
      moveBody ? `${moveBody} ${pgnResult}` : pgnResult,
    ].join("\n");

    // Step 5: prisma transaction — rating update + game insert
    let ratingDeltas: { white: number; black: number } | null = null;
    let ratingsAfter: { white: number; black: number } | null = null;

    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        const ratingResult = await this.ratingService.applyGameResult({
          whiteUserId,
          blackUserId,
          mode,
          result,
          tx,
        });

        await this.gameRepository.createCompletedGame(
          {
            mode,
            timeControlMs,
            whiteUserId,
            blackUserId,
            result: result as GameResult,
            endReason: reason as PrismaGameEndReason,
            pgn,
            finalFen,
            whiteRatingBefore,
            whiteRatingAfter: ratingResult.whiteAfter,
            blackRatingBefore,
            blackRatingAfter: ratingResult.blackAfter,
            startedAt,
            endedAt,
          },
          tx,
        );

        return { ratingResult };
      });

      ratingDeltas = {
        white: txResult.ratingResult.whiteDelta,
        black: txResult.ratingResult.blackDelta,
      };
      ratingsAfter = {
        white: txResult.ratingResult.whiteAfter,
        black: txResult.ratingResult.blackAfter,
      };
    } catch (err) {
      this.logger.error(`endGame transaction failed for game ${gameId}`, err);
      // TODO: implement retry/recovery mechanism for stuck games (endPhaseLockedBy never released)
      return;
    }

    // Step 6: mark redis as fully persisted and set TTLs
    const pipe = this.redis.pipeline();
    pipe.hset(`game:${gameId}`, "status", "ended-persisted");
    pipe.expire(`game:${gameId}`, 3600);
    pipe.expire(`game:${gameId}:moves`, 3600);
    if (whiteUserId) pipe.expire(`user:activeGame:${whiteUserId}`, 3600);
    if (blackUserId) pipe.expire(`user:activeGame:${blackUserId}`, 3600);
    pipe.srem("game:active", gameId);
    await pipe.exec();

    // Step 7: emit full game.end payload
    const payload: GameEndPayload = {
      gameId,
      result,
      endReason: reason,
      winner,
      finalFen,
      pgn,
      ratingDeltas,
      ratingsAfter,
    };
    this.realtime.toRoom("play", `game:${gameId}`).emit("game.end", payload);
  }
}
