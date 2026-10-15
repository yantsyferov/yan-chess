// @layer: unit
// @spec: 011-production-deployment
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the resend SDK before importing the mailer
const mockEmailsSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

// Import after mock is set up
const { ResendMailer } = await import(
  "../../src/modules/mail/resend.mailer.js"
);

const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
};

vi.mock("@nestjs/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nestjs/common")>();
  return {
    ...actual,
    Logger: vi.fn().mockImplementation(() => mockLogger),
  };
});

describe("ResendMailer", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("constructor throws when RESEND_API_KEY is not set", () => {
    process.env["RESEND_API_KEY"] = "";
    expect(() => new ResendMailer()).toThrowError("RESEND_API_KEY not set");
  });

  it("send() calls Resend SDK with correct shape and omits token field", async () => {
    process.env["RESEND_API_KEY"] = "test-key-abc";
    process.env["MAIL_FROM"] = undefined as unknown as string;
    delete process.env["MAIL_FROM"];

    mockEmailsSend.mockResolvedValueOnce({ data: { id: "email-123" }, error: null });

    const mailer = new ResendMailer();
    await mailer.send({ to: "x@y.z", subject: "s", html: "<p>h</p>", token: "ignored" });

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: "YanChess <onboarding@resend.dev>",
      to: "x@y.z",
      subject: "s",
      html: "<p>h</p>",
    });
    // token must NOT appear in the call args
    const callArg = mockEmailsSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("token");
  });

  it("send() throws when Resend returns an error response", async () => {
    process.env["RESEND_API_KEY"] = "test-key-abc";
    mockEmailsSend.mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });

    const mailer = new ResendMailer();
    await expect(
      mailer.send({ to: "x@y.z", subject: "s", html: "<p>h</p>" }),
    ).rejects.toThrow("rate limited");
  });
});
