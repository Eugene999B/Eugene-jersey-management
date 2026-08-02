import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  resolveMx: vi.fn().mockResolvedValue([{ exchange: "gmail-smtp-in.l.google.com", priority: 5 }]),
}));

import { sendTransactionalEmail } from "@/lib/transactional-email";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Gmail transactional delivery", () => {
  it("refreshes OAuth and sends a multipart OTP message through the authenticated Gmail mailbox", async () => {
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.EMAIL_FROM = "Eugene Shop Management <eugenejerseymanagement@gmail.com>";
    process.env.GMAIL_CLIENT_ID = "gmail-client-id";
    process.env.GMAIL_CLIENT_SECRET = "gmail-client-secret";
    process.env.GMAIL_REFRESH_TOKEN = "gmail-refresh-token";

    let sentRaw = "";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "gmail-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockImplementationOnce(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { raw: string };
        sentRaw = Buffer.from(body.raw, "base64url").toString("utf8");
        return new Response(JSON.stringify({ id: "gmail-message-123", threadId: "gmail-thread-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      to: "customer@gmail.com",
      recipientName: "Customer",
      subject: "Your Eugene Shop Management code",
      text: "Your code is 123456.",
      html: "<p>Your code is <strong>123456</strong>.</p>",
      idempotencyKey: "test/gmail/otp/123456",
      tags: { category: "otp" },
    });

    expect(result).toEqual({ providerReference: "gmail-message-123", recipient: "customer@gmail.com" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://oauth2.googleapis.com/token");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(sentRaw).toContain("From: Eugene Shop Management <eugenejerseymanagement@gmail.com>");
    expect(sentRaw).toContain("To: customer@gmail.com");
    expect(sentRaw).toContain("Subject: Your Eugene Shop Management code");
    expect(sentRaw).toContain("Content-Type: multipart/alternative");
    expect(sentRaw).toContain(Buffer.from("Your code is 123456.", "utf8").toString("base64"));
    expect(sentRaw).toContain(Buffer.from("<p>Your code is <strong>123456</strong>.</p>", "utf8").toString("base64"));
    expect(sentRaw).not.toContain("gmail-client-secret");
    expect(sentRaw).not.toContain("gmail-refresh-token");
  });
});
