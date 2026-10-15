import { create } from "zustand";
import type { Socket } from "socket.io-client";
import type { Mode } from "@yanchess/shared";
import { getSocket } from "./socket";
import { useOnlineGameStore } from "./useOnlineGameStore";

type Phase = "idle" | "searching";

interface MatchmakingState {
  phase: Phase;
  mode: Mode | null;
  since: number | null;
  joinQueue(mode: Mode): void;
  leaveQueue(): void;
}

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  phase: "idle",
  mode: null,
  since: null,
  joinQueue(mode: Mode): void {
    useOnlineGameStore.getState().markPendingNavigate();
    const sock = getSocket();
    sock.emit("queue.join", { mode });
    set({ phase: "searching", mode, since: Date.now() });
  },
  leaveQueue(): void {
    useOnlineGameStore.getState().clearPendingNavigate();
    const sock = getSocket();
    sock.emit("queue.leave", {});
    set({ phase: "idle", mode: null, since: null });
  },
}));

/** Last socket instance that handlers were attached to. */
let wiredSocket: Socket | null = null;

/**
 * Attach matchmaking event handlers to the given socket instance.
 * Safe to call multiple times — idempotent per socket instance.
 */
export function attachMatchmakingHandlers(sock: Socket): void {
  if (wiredSocket === sock) return; // already wired to this instance
  wiredSocket = sock;
  sock.on("queue.joined", (payload: { mode: Mode; since: number }) => {
    useMatchmakingStore.setState({ phase: "searching", mode: payload.mode, since: payload.since });
  });
  sock.on("queue.left", () => {
    useMatchmakingStore.setState({ phase: "idle", mode: null, since: null });
  });
}

/**
 * No-arg convenience wrapper used by Play.tsx.
 * Wires to the current socket; re-wires automatically if the socket was rebuilt.
 */
export function wireMatchmakingSocket(): void {
  attachMatchmakingHandlers(getSocket());
}
