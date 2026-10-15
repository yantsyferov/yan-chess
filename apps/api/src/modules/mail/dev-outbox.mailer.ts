import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MailMessage, MailService } from "./mail.service";

@Injectable()
export class DevOutboxMailer extends MailService {
  private readonly logger = new Logger(DevOutboxMailer.name);
  // Resolve relative to process cwd when run via `pnpm --filter api dev` (cwd = apps/api).
  private readonly outboxDir = join(process.cwd(), "dev-outbox");

  async send(message: MailMessage): Promise<void> {
    await mkdir(this.outboxDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const id = randomUUID();
    const path = join(this.outboxDir, `${timestamp}-${id}.json`);
    await writeFile(path, JSON.stringify(message, null, 2), "utf8");
    this.logger.log(`Dev mail written: ${path} (to=${message.to}, subject="${message.subject}")`);
  }
}
