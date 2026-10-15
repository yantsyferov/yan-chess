import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  constructor(
    // IoAdapter accepts the Nest app or an http.Server — `any` is the
    // established escape hatch here since IoAdapter's constructor signature
    // uses overloads that are not easily expressed without `any`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appOrHttpServer: any,
    private readonly pub: Redis,
    private readonly sub: Redis,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super(appOrHttpServer);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIOServer(port: number, options?: ServerOptions): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const server = super.createIOServer(port, options);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    server.adapter(createAdapter(this.pub, this.sub));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return server;
  }
}
