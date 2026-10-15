import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { RedisService } from './modules/redis/redis.service';
import { RedisIoAdapter } from './socket-io/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env['WEB_URL'] ?? 'http://localhost:5173', credentials: true });
  app.enableShutdownHooks();

  await app.init();
  const redisService = app.get(RedisService);
  const pub = redisService.raw.duplicate();
  const sub = redisService.raw.duplicate();
  await Promise.all([pub.connect(), sub.connect()]);
  app.useWebSocketAdapter(new RedisIoAdapter(app, pub, sub));

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}`);
}

bootstrap();
