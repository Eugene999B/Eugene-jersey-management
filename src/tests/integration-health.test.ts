import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkArkeselHealth,
  checkPaystackHealth,
  checkShopPaystackSubaccount,
  checkWhatsAppHealth,
} from "@/lib/integration-health";

const ENV_KEYS = [
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PLATFORM_ACCOUNT_LABEL",
  "SMS_PROVIDER",
  "ARKESEL_API_KEY",
  "ARKESEL_SENDER_ID",
  "WHATSAPP_PROVIDER",
  "WHATSAPP_API_TOKEN",
  "WHATSAPP_HEALTH_URL",
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

describe("production integration health", () => {
  it("does not call Paystack when the administrator account is unconfigured", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkPaystackHealth();

    expect(result.state).toBe("unconfigured");
    expect(result.reachable).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recognises a reachable live administrator Paystack account", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_live_platform_test_value";
    process.env.PAYSTACK_PLATFORM_ACCOUNT_LABEL = "EJM platform settlement";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: [{ currency: "GHS", balance: 125050 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await checkPaystackHealth();

    expect(result.state).toBe("healthy");
    expect(result.metadata.mode).toBe("live");
    expect(result.metadata.balances).toEqual([{ currency: "GHS", amount: 1250.5 }]);
  });

  it("warns when Arkesel is reachable but SMS credits are low", async () => {
    process.env.SMS_PROVIDER = "arkesel";
    process.env.ARKESEL_API_KEY = "test-arkesel-key";
    process.env.ARKESEL_SENDER_ID = "EJM";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: { sms_balance: "12", main_balance: "GHS 5.00" },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await checkArkeselHealth();

    expect(result.state).toBe("attention");
    expect(result.reachable).toBe(true);
    expect(result.metadata.smsBalance).toBe(12);
  });

  it("never uses the WhatsApp send endpoint as a health check", async () => {
    process.env.WHATSAPP_PROVIDER = "generic";
    process.env.WHATSAPP_API_TOKEN = "test-whatsapp-token";
    delete process.env.WHATSAPP_HEALTH_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkWhatsAppHealth();

    expect(result.state).toBe("attention");
    expect(result.reachable).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies a shop-owned Paystack subaccount without exposing its full account number", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_platform_value";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: {
        subaccount_code: "ACCT_store123",
        business_name: "Store One",
        settlement_bank: "Test Bank",
        account_number: "1234567890",
        account_name: "STORE ONE LTD",
        currency: "GHS",
        percentage_charge: 2.5,
        active: true,
        is_verified: true,
        domain: "test",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await checkShopPaystackSubaccount("ACCT_store123");

    expect(result.state).toBe("healthy");
    expect(result.metadata.businessName).toBe("Store One");
    expect(result.metadata.settlementAccountMasked).toBe("••••••7890");
    expect(JSON.stringify(result)).not.toContain("1234567890");
  });
});
