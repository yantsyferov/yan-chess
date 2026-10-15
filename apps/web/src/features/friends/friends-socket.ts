import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../auth/useAuthStore";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3000/api/v1";
// Strip trailing /api/v1 to get origin for Socket.IO (which uses path '/socket.io' at origin)
const ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

let socket: Socket | null = null;
// sentinel: `undefined` means never built; `null | string` is the token used
let builtWithToken: string | null | undefined = undefined;

export function getFriendsSocket(): Socket {
  const currentToken = useAuthStore.getState().accessToken;
  // Rebuild if token changed since last build (covers the page-reload case where
  // fetchMe() restores a new access token after the socket was built with null).
  if (socket !== null && builtWithToken !== currentToken) {
    socket.disconnect();
    socket = null;
  }
  if (socket !== null) return socket;
  socket = io(`${ORIGIN}/friends`, {
    auth: { token: currentToken ? `Bearer ${currentToken}` : undefined },
    transports: ["websocket"],
    autoConnect: true,
  });
  builtWithToken = currentToken;
  socket.on("connect", () => {
    socket!.emit("hello");
  });
  socket.on("connect_error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[friends-socket] connect_error", err.message);
  });
  return socket;
}

export function disconnectFriendsSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    builtWithToken = undefined;
  }
}

export function resetFriendsSocket(): void {
  disconnectFriendsSocket();
}
