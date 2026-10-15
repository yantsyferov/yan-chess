export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  token?: string; // for dev inspection — the raw token embedded in the email link
}

export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
