import { create } from "zustand";
import type { Socket } from "socket.io-client";
import type { Mode, GameColor, GameResult, GameEndReason } from "@yanchess/shared";
import { getSocket } from "./socket";
import { useMatchmakingStore } from "./useMatchmakingStore";

interface Clocks {
  whiteMs: number;
  blackMs: number;
}

interface Opponent {
  nickname: string;
  rating: number;
  online: boolean;
}

interface OnlineGameState {
  gameId: string | null;
  mode: Mode | null;
  timeControlMs: number;
  fen: string;
  movesSan: string[];
  clocks: Clocks;
  serverNow: number;
  lastSyncClientMs: number;
  sideToMove: GameColor;
  color: GameColor | null;
  opponent: Opponent | null;
  lastMove: { from: string; to: string } | null;
  // for later slices (keep nullable):
  pendingPromotion: { from: string; to: string } | null;
  pendingDrawOffer: { from: GameColor } | null;
  pendingResign: boolean;
  drawOfferCooldownMoves: number | null;
  drawDeclinedToast: boolean;
  result: GameResult | null;
  winner: GameColor | null;
  endReason: GameEndReason | null;
  ratingDelta: number | null;
  ratingsAfter: { white: number; black: number } | null;
  resultModalDismissed: boolean;
  pendingRematch: { from: "me" | "opponent"; expiresAt: number } | null;
  rematchExpiredToast: boolean;
  pendingNavigate: boolean;
}

interface OnlineGameActions {
  reset(): void;
  makeMove(from: string, to: string, promotion?: string): void;
  setPendingPromotion(pending: { from: string; to: string } | null): void;
  cancelPromotion(): void;
  openResign(): void;
  cancelResign(): void;
  confirmResign(): void;
  offerDraw(): void;
  respondDraw(accept: boolean): void;
  clearDrawDeclinedToast(): void;
  dismissResult(): void;
  startNewGame(): void;
  offerRematch(): void;
  respondRematch(accept: boolean): void;
  clearRematchExpired(): void;
  markPendingNavigate(): void;
  clearPendingNavigate(): void;
}

const INITIAL_STATE: OnlineGameState = {
  gameId: null,
  mode: null,
  timeControlMs: 0,
  fen: "",
  movesSan: [],
  clocks: { whiteMs: 0, blackMs: 0 },
  serverNow: 0,
  lastSyncClientMs: 0,
  sideToMove: "white",
  color: null,
  opponent: null,
  lastMove: null,
  pendingPromotion: null,
  pendingDrawOffer: null,
  pendingResign: false,
  drawOfferCooldownMoves: null,
  drawDeclinedToast: false,
  result: null,
  winner: null,
  endReason: null,
  ratingDelta: null,
  ratingsAfter: null,
  resultModalDismissed: false,
  pendingRematch: null,
  rematchExpiredToast: false,
  pendingNavigate: false,
};

export const useOnlineGameStore = create<OnlineGameState & OnlineGameActions>(
  (set, get) => ({
    ...INITIAL_STATE,
    reset(): void {
      set(INITIAL_STATE);
    },
    makeMove(from: string, to: string, promotion?: string): void {
      const { gameId } = get();
      if (gameId === null) return;
      getSocket().emit("game.move", { gameId, from, to, ...(promotion ? { promotion } : {}) });
    },
    setPendingPromotion(pending: { from: string; to: string } | null): void {
      set({ pendingPromotion: pending });
    },
    cancelPromotion(): void {
      set({ pendingPromotion: null });
    },
    openResign(): void {
      set({ pendingResign: true });
    },
    cancelResign(): void {
      set({ pendingResign: false });
    },
    confirmResign(): void {
      const { gameId } = get();
      if (gameId !== null) {
        getSocket().emit("game.resign", { gameId });
      }
      set({ pendingResign: false });
    },
    offerDraw(): void {
      const { gameId } = get();
      if (gameId !== null) {
        getSocket().emit("game.offerDraw", { gameId });
      }
    },
    respondDraw(accept: boolean): void {
      const { gameId } = get();
      if (gameId !== null) {
        getSocket().emit("game.respondDraw", { gameId, accept });
      }
      set({ pendingDrawOffer: null });
    },
    clearDrawDeclinedToast(): void {
      set({ drawDeclinedToast: false });
    },
    dismissResult(): void {
      set({ resultModalDismissed: true });
    },
    startNewGame(): void {
      set(INITIAL_STATE);
    },
    offerRematch(): void {
      const { gameId } = get();
      if (gameId !== null) {
        getSocket().emit("game.offerRematch", { gameId });
      }
      const expiresAt = Date.now() + 30_000;
      set({ pendingRematch: { from: "me", expiresAt } });
      window.setTimeout(() => {
        const s = useOnlineGameStore.getState();
        if (s.pendingRematch?.from === "me") {
          useOnlineGameStore.setState({ pendingRematch: null, rematchExpiredToast: true });
          window.setTimeout(() => {
            useOnlineGameStore.setState({ rematchExpiredToast: false });
          }, 3000);
        }
      }, 30_000);
    },
    respondRematch(accept: boolean): void {
      const { gameId } = get();
      if (gameId !== null) {
        getSocket().emit("game.respondRematch", { gameId, accept });
      }
      set({ pendingRematch: null });
    },
    clearRematchExpired(): void {
      set({ rematchExpiredToast: false });
    },
    markPendingNavigate(): void {
      set({ pendingNavigate: true });
    },
    clearPendingNavigate(): void {
      set({ pendingNavigate: false });
    },
  }),
);

/** Last socket instance that handlers were attached to. */
let wiredSocket: Socket | null = null;

/**
 * Attach online-game event handlers to the given socket instance.
 * Safe to call multiple times — idempotent per socket instance.
 */
export function attachOnlineGameHandlers(sock: Socket): void {
  if (wiredSocket === sock) return; // already wired to this instance
  wiredSocket = sock;
  sock.on(
    "game.start",
    (payload: {
      gameId: string;
      color: GameColor;
      opponent: { nickname: string; rating: number };
      mode: Mode;
      timeControlMs: number;
      fen: string;
      clocks: Clocks;
      sideToMove: GameColor;
      serverNow: number;
    }) => {
      useOnlineGameStore.setState({
        gameId: payload.gameId,
        mode: payload.mode,
        timeControlMs: payload.timeControlMs,
        fen: payload.fen,
        movesSan: [],
        clocks: payload.clocks,
        serverNow: payload.serverNow,
        lastSyncClientMs: Date.now(),
        sideToMove: payload.sideToMove,
        color: payload.color,
        opponent: { ...payload.opponent, online: true },
        lastMove: null,
        pendingRematch: null,
        rematchExpiredToast: false,
      });
      // Transition matchmaking out of "searching" so Play.tsx can switch phases
      useMatchmakingStore.setState({ phase: "idle", mode: null, since: null });
    },
  );

  sock.on(
    "game.state",
    (p: {
      gameId: string;
      fen: string;
      lastMove: { from: string; to: string };
      san: string;
      clocks: Clocks;
      sideToMove: GameColor;
      moveNumber: number;
      serverNow: number;
    }) => {
      const prev = useOnlineGameStore.getState();
      if (prev.gameId !== p.gameId) return;
      useOnlineGameStore.setState({
        fen: p.fen,
        movesSan: [...prev.movesSan, p.san],
        clocks: p.clocks,
        serverNow: p.serverNow,
        lastSyncClientMs: Date.now(),
        sideToMove: p.sideToMove,
        lastMove: p.lastMove,
        pendingPromotion: null,
      });
    },
  );

  sock.on(
    "game.snapshot",
    (payload: {
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
    }) => {
      useOnlineGameStore.setState({
        gameId: payload.gameId,
        mode: payload.mode,
        timeControlMs: payload.timeControlMs,
        fen: payload.fen,
        movesSan: payload.movesSan,
        clocks: payload.clocks,
        serverNow: payload.serverNow,
        lastSyncClientMs: Date.now(),
        sideToMove: payload.sideToMove,
        color: payload.color,
        opponent: payload.opponent,
        lastMove: payload.lastMove,
        pendingPromotion: null,
        pendingDrawOffer: null,
        pendingResign: false,
        drawOfferCooldownMoves: null,
        drawDeclinedToast: false,
        result: null,
        winner: null,
        endReason: null,
        ratingDelta: null,
        ratingsAfter: null,
        resultModalDismissed: false,
      });
      useMatchmakingStore.setState({ phase: "idle", mode: null, since: null });
    },
  );

  sock.on(
    "game.opponentOnline",
    (payload: { gameId: string; color: GameColor; online: boolean }) => {
      const state = useOnlineGameStore.getState();
      if (state.gameId !== payload.gameId) return;
      // payload.color is the colour of the user whose online state changed.
      // Only update opponent indicator when it's the opponent's state changing.
      if (payload.color !== state.color && state.opponent !== null) {
        useOnlineGameStore.setState({
          opponent: { ...state.opponent, online: payload.online },
        });
      }
    },
  );

  sock.on("game.moveRejected", (p: { gameId: string; reason: string }) => {
    const prev = useOnlineGameStore.getState();
    if (prev.gameId !== p.gameId) return;
    useOnlineGameStore.setState({ pendingPromotion: null });
  });

  sock.on(
    "game.drawOffered",
    (p: { gameId: string; byColor: GameColor }) => {
      const store = useOnlineGameStore.getState();
      if (store.gameId !== p.gameId) return;
      // Only show dialog if the offer came from the opponent
      if (p.byColor !== store.color) {
        useOnlineGameStore.setState({ pendingDrawOffer: { from: p.byColor } });
      }
    },
  );

  sock.on("game.drawDeclined", (p: { gameId: string }) => {
    const store = useOnlineGameStore.getState();
    if (store.gameId !== p.gameId) return;
    useOnlineGameStore.setState({ drawDeclinedToast: true });
    setTimeout(() => {
      useOnlineGameStore.getState().clearDrawDeclinedToast();
    }, 3000);
  });

  sock.on(
    "game.actionRejected",
    (p: { gameId: string; reason: string; remainingMoves?: number }) => {
      const store = useOnlineGameStore.getState();
      if (store.gameId !== p.gameId) return;
      if (p.reason === "draw_offer_cooldown") {
        useOnlineGameStore.setState({
          drawOfferCooldownMoves: p.remainingMoves ?? null,
        });
        setTimeout(() => {
          useOnlineGameStore.setState({ drawOfferCooldownMoves: null });
        }, 3000);
      }
    },
  );

  sock.on(
    "game.end",
    (p: {
      gameId: string;
      result: GameResult;
      winner?: GameColor | null;
      endReason: GameEndReason;
      finalFen: string | null;
      pgn: string | null;
      ratingDeltas: { white: number; black: number } | null;
      ratingsAfter: { white: number; black: number } | null;
    }) => {
      const prev = useOnlineGameStore.getState();
      if (prev.gameId !== p.gameId) return;
      // Derive winner from result if not explicitly provided
      const winner: GameColor | null =
        p.winner !== undefined
          ? (p.winner ?? null)
          : p.result === "white_win"
            ? "white"
            : p.result === "black_win"
              ? "black"
              : null;
      useOnlineGameStore.setState({
        result: p.result,
        winner,
        endReason: p.endReason,
        resultModalDismissed: false,
        ratingDelta:
          p.ratingDeltas !== null
            ? prev.color === "white"
              ? p.ratingDeltas.white
              : p.ratingDeltas.black
            : null,
        ratingsAfter: p.ratingsAfter,
      });
    },
  );

  sock.on("game.rematchOffered", (p: { previousGameId: string; byUserId: string }) => {
    const state = useOnlineGameStore.getState();
    if (state.gameId !== p.previousGameId) return;
    useOnlineGameStore.setState({ pendingRematch: { from: "opponent", expiresAt: Date.now() + 30_000 } });
    window.setTimeout(() => {
      const s = useOnlineGameStore.getState();
      if (s.pendingRematch?.from === "opponent") {
        useOnlineGameStore.setState({ pendingRematch: null });
      }
    }, 30_000);
  });

  sock.on("game.rematchDeclined", (_p: { previousGameId: string }) => {
    useOnlineGameStore.setState({ pendingRematch: null, rematchExpiredToast: true });
    window.setTimeout(() => useOnlineGameStore.setState({ rematchExpiredToast: false }), 3000);
  });
}

/** No-arg convenience wrapper used by Play.tsx (wires to the current socket). */
export function wireOnlineGameSocket(): void {
  attachOnlineGameHandlers(getSocket());
}
