import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { MailMessage, MailService } from "./mail.service";

@Injectable()
export class ResendMailer extends MailService {
  private readonly logger = new Logger(ResendMailer.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    super();
    const key = process.env["RESEND_API_KEY"];
    if (!key) throw new Error("RESEND_API_KEY not set");
    this.resend = new Resend(key);
    this.from = process.env["MAIL_FROM"] ?? "YanChess <onboarding@resend.dev>";
  }

  async send(msg: MailMessage): Promise<void> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
    this.logger.log(`Resend emailId=${data?.id} to=${msg.to}`);
  }
}
