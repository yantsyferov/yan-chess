import { ArgumentsHost, Catch } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

interface WsErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  override catch(exception: WsException, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const raw = exception.getError();
    const code = typeof raw === "string" ? raw : "INTERNAL";

    const response: WsErrorResponse = {
      error: {
        code,
        message: code === "UNAUTHORIZED" ? "Unauthorized" : "Internal error",
      },
    };

    // Send error as acknowledgement callback if present, otherwise emit error event
    const args = host.switchToWs().getData();
    const ack = Array.isArray(args)
      ? (args.find((a) => typeof a === "function") as ((res: WsErrorResponse) => void) | undefined)
      : undefined;

    if (ack) {
      ack(response);
    } else {
      client.emit("exception", response);
    }
  }
}
