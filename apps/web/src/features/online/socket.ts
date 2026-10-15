import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../auth/useAuthStore";

const API_BASE = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000/api/v1";
// Strip trailing /api/v1 to get origin for Socket.IO (which uses path '/socket.io' at origin)
const ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

let socket: Socket | null = null;
// sentinel: `undefined` means never built; `null | string` is the token used
let builtWithToken: string | null | undefined = undefined;

export function getSocket(): Socket {
  const currentToken = useAuthStore.getState().accessToken;
  // Rebuild if token changed since last build (covers the page-reload case where
  // fetchMe() restores a new access token after the socket was built with null).
  if (socket !== null && builtWithToken !== currentToken) {
    socket.disconnect();
    socket = null;
  }
  if (socket !== null) return socket;
  socket = io(`${ORIGIN}/play`, {
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
    console.warn("[socket] connect_error", err.message);
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function resetSocket(): void {
  disconnectSocket();
}
