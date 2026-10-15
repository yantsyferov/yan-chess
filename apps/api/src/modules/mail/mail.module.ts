import { Global, Module } from "@nestjs/common";
import { DevOutboxMailer } from "./dev-outbox.mailer";
import { ResendMailer } from "./resend.mailer";
import { MailService } from "./mail.service";

const driver = process.env["MAIL_DRIVER"] ?? "outbox";

const mailerProvider =
  driver === "resend"
    ? { provide: MailService, useClass: ResendMailer }
    : { provide: MailService, useClass: DevOutboxMailer };

@Global()
@Module({
  providers: [mailerProvider],
  exports: [MailService],
})
export class MailModule {}
