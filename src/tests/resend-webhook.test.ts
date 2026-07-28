import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseResendWebhookPayload,
  verifyResendWebhookSignature,
} from "@/lib/resend-webhook";

function signedHeaders(payload: string, nowSeconds = 1_800_000_000) {
  const id = "msg_release28_test";
  const timestamp = String(nowSeconds);
  const key = Buffer.from("release-28-webhook-test-key");
  const secret = `whsec_${key.toString("base64")}`;
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return {
    secret,
    headers: { id, timestamp, signature: `v1,${signature}` },
    nowSeconds,
  };
}

describe("Resend webhook verification", () => {
  it("accepts a current signature over the raw payload", () => {
    const payload = JSON.stringify({ type: "email.delivered", created_at: "2027-01-15T00:00:00.000Z", data: { email_id: "email_123" } });
    const signed = signedHeaders(payload);
    expect(verifyResendWebhookSignature({ payload, ...signed })).toBe(true);
  });

  it("rejects payload changes and stale signatures", () => {
    const payload = JSON.stringify({ type: "email.sent", created_at: "2027-01-15T00:00:00.000Z", data: { email_id: "email_123" } });
    const signed = signedHeaders(payload);
    expect(verifyResendWebhookSignature({ payload: `${payload} `, ...signed })).toBe(false);
    expect(verifyResendWebhookSignature({ payload, ...signed, nowSeconds: signed.nowSeconds + 301 })).toBe(false);
  });

  it("extracts only safe delivery fields from bounce events", () => {
    const payload = JSON.stringify({
      type: "email.bounced",
      created_at: "2027-01-15T00:00:00.000Z",
      data: {
        email_id: "email_456",
        to: ["private@gmail.com"],
        subject: "Private subject",
        bounce: { message: "Mailbox unavailable\nSMTP 550" },
        tags: { category: "password_recovery" },
      },
    });
    const parsed = parseResendWebhookPayload(payload);
    expect(parsed?.eventType).toBe("email.bounced");
    expect(parsed?.providerReference).toBe("email_456");
    expect(parsed?.detail).toBe("Mailbox unavailable SMTP 550");
    expect(JSON.stringify(parsed?.safePayload)).not.toContain("private@gmail.com");
    expect(JSON.stringify(parsed?.safePayload)).not.toContain("Private subject");
  });
});