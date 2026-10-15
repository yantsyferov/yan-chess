// @layer: unit
// @spec: 011-production-deployment
// @regression
//
// Tests that MailModule wires the correct mailer implementation based on MAIL_DRIVER.
// mail.module.ts evaluates MAIL_DRIVER at module-load time (top-level const), so each
// test must reset modules and re-import to pick up the new env value.

import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub the Resend SDK so ResendMailer can be constructed without a real API key.
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn() },
  })),
}));

describe("MailModule — driver branching", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore env exactly as it was before the test suite
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("resend branch: resolves ResendMailer when MAIL_DRIVER=resend", async () => {
    // @regression
    process.env["MAIL_DRIVER"] = "resend";
    process.env["RESEND_API_KEY"] = "test-key-for-unit-tests";

    // Dynamic import AFTER env is set so the top-level const picks up the value
    const { Test } = await import("@nestjs/testing");
    const { MailModule } = await import("../../src/modules/mail/mail.module.js");
    const { MailService } = await import("../../src/modules/mail/mail.service.js");
    const { ResendMailer } = await import("../../src/modules/mail/resend.mailer.js");

    const moduleRef = await Test.createTestingModule({
      imports: [MailModule],
    }).compile();

    const mailer = moduleRef.get(MailService);
    expect(mailer).toBeInstanceOf(ResendMailer);

    await moduleRef.close();
  });

  it("outbox branch: resolves DevOutboxMailer when MAIL_DRIVER=outbox", async () => {
    // @regression
    process.env["MAIL_DRIVER"] = "outbox";

    const { Test } = await import("@nestjs/testing");
    const { MailModule } = await import("../../src/modules/mail/mail.module.js");
    const { MailService } = await import("../../src/modules/mail/mail.service.js");
    const { DevOutboxMailer } = await import("../../src/modules/mail/dev-outbox.mailer.js");

    const moduleRef = await Test.createTestingModule({
      imports: [MailModule],
    }).compile();

    const mailer = moduleRef.get(MailService);
    expect(mailer).toBeInstanceOf(DevOutboxMailer);

    await moduleRef.close();
  });

  it("default branch: resolves DevOutboxMailer when MAIL_DRIVER is unset", async () => {
    // @regression
    delete process.env["MAIL_DRIVER"];

    const { Test } = await import("@nestjs/testing");
    const { MailModule } = await import("../../src/modules/mail/mail.module.js");
    const { MailService } = await import("../../src/modules/mail/mail.service.js");
    const { DevOutboxMailer } = await import("../../src/modules/mail/dev-outbox.mailer.js");

    const moduleRef = await Test.createTestingModule({
      imports: [MailModule],
    }).compile();

    const mailer = moduleRef.get(MailService);
    expect(mailer).toBeInstanceOf(DevOutboxMailer);

    await moduleRef.close();
  });
});
