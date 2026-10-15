import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeEmitter } from "./realtime-emitter";
import { PresenceService } from "./presence.service";

@Module({
  imports: [PrismaModule],
  providers: [RealtimeEmitter, PresenceService],
  exports: [RealtimeEmitter, PresenceService],
})
export class RealtimeModule {}
