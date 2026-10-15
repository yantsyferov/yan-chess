import { Injectable, Logger } from "@nestjs/common";
import type { Server } from "socket.io";

@Injectable()
export class RealtimeEmitter {
  private readonly logger = new Logger(RealtimeEmitter.name);
  private readonly namespaces = new Map<string, Server>();

  register(namespace: string, server: Server): void {
    if (this.namespaces.has(namespace)) {
      this.logger.warn(
        `Re-registering namespace '${namespace}' — expected during tests, suspicious in production`,
      );
    } else {
      this.logger.log(`Registered namespace '${namespace}'`);
    }
    this.namespaces.set(namespace, server);
  }

  toRoom(namespace: string, room: string): ReturnType<Server["to"]> {
    const server = this.namespaces.get(namespace);
    if (!server) {
      throw new Error(
        `RealtimeEmitter: namespace '${namespace}' not registered — did the gateway's afterInit run?`,
      );
    }
    return server.to(room);
  }

  toUser(userId: string, namespace: string): ReturnType<Server["to"]> {
    return this.toRoom(namespace, `user:${userId}`);
  }

  async socketCount(userId: string): Promise<number> {
    let total = 0;
    for (const [, server] of this.namespaces) {
      const sockets = await server.in(`user:${userId}`).fetchSockets();
      total += sockets.length;
    }
    return total;
  }
}
