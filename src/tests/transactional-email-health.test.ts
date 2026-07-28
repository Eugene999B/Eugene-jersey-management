import { afterEach, describe, expect, it, vi } from "vitest";
import { checkTransactionalEmailHealth } from "@/lib/production-integration-health";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
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

describe("transactional email health", () => {
  it("does not call a provider when credentials are incomplete", async () => {
    process.env.EMAIL_PROVIDER = "console";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
    delete process.env.GMAIL_REFRESH_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkTransactionalEmailHealth();

    expect(result.state).toBe("unconfigured");
    expect(result.reachable).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the authenticated company Gmail mailbox healthy", async () => {
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.EMAIL_FROM = "Eugene Jersey Management <eugenejerseymanagement@gmail.com>";
    process.env.GMAIL_CLIENT_ID = "gmail-client-id";
    process.env.GMAIL_CLIENT_SECRET = "gmail-client-secret";
    process.env.GMAIL_REFRESH_TOKEN = "gmail-refresh-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "gmail-access-token",
        expires_in: 3600,
        scope: "openid email https://www.googleapis.com/auth/gmail.send",
        token_type: "Bearer",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        email: "eugenejerseymanagement@gmail.com",
        email_verified: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkTransactionalEmailHealth();

    expect(result.state).toBe("healthy");
    expect(result.reachable).toBe(true);
    expect(result.metadata.provider).toBe("gmail");
    expect(result.metadata.authenticatedEmail).toBe("eugenejerseymanagement@gmail.com");
    expect(result.metadata.senderMatches).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports attention when Gmail authenticates a different mailbox", async () => {
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.EMAIL_FROM = "Eugene Jersey Management <eugenejerseymanagement@gmail.com>";
    process.env.GMAIL_CLIENT_ID = "gmail-client-id";
    process.env.GMAIL_CLIENT_SECRET = "gmail-client-secret";
    process.env.GMAIL_REFRESH_TOKEN = "gmail-refresh-token";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "gmail-access-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        email: "another-account@gmail.com",
        email_verified: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await checkTransactionalEmailHealth();

    expect(result.state).toBe("attention");
    expect(result.reachable).toBe(true);
    expect(result.metadata.senderMatches).toBe(false);
  });

  it("marks a verified Resend sending domain healthy", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_release28_test";
    process.env.EMAIL_FROM = "Eugene Jersey Management <verify@mail.ejm.test>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      object: "list",
      has_more: false,
      data: [{
        name: "mail.ejm.test",
        status: "verified",
        capabilities: { sending: "enabled", receiving: "disabled" },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await checkTransactionalEmailHealth();

    expect(result.state).toBe("healthy");
    expect(result.reachable).toBe(true);
    expect(result.metadata.senderDomain).toBe("mail.ejm.test");
    expect(result.metadata.domainStatus).toBe("verified");
  });

  it("reports attention when Resend credentials work but the sender domain is not verified", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_release28_test";
    process.env.EMAIL_FROM = "Eugene Jersey Management <verify@pending.ejm.test>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        name: "pending.ejm.test",
        status: "pending",
        capabilities: { sending: "disabled" },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await checkTransactionalEmailHealth();

    expect(result.state).toBe("attention");
    expect(result.reachable).toBe(true);
    expect(result.metadata.domainStatus).toBe("pending");
  });
});
