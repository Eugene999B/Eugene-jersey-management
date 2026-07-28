import { afterEach, describe, expect, it, vi } from "vitest";
import { checkTransactionalEmailHealth } from "@/lib/production-integration-health";

const ENV_KEYS = ["EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM"] as const;
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
  it("does not call Resend when credentials are incomplete", async () => {
    process.env.EMAIL_PROVIDER = "console";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkTransactionalEmailHealth();

    expect(result.state).toBe("unconfigured");
    expect(result.reachable).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a verified sending domain healthy", async () => {
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

  it("reports attention when credentials work but the sender domain is not verified", async () => {
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