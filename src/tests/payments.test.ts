import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  amountToSubunit,
  initializePlatformPaystackTransaction,
  isPaystackCheckoutReady,
  normalizePaystackChargeBearer,
  verifyPaystackWebhookSignature,
} from "@/lib/payments";

describe("Paystack helpers", () => {
  const previousKey = process.env.PAYSTACK_SECRET_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousKey;
  });

  it("converts amounts to the smallest currency unit", () => {
    expect(amountToSubunit(10)).toBe(1000);
    expect(amountToSubunit(12.34)).toBe(1234);
    expect(amountToSubunit(0.1)).toBe(10);
  });

  it("requires secret key, card allowance, and a valid shop subaccount before checkout is ready", () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(isPaystackCheckoutReady({ allowCard: true, paystackSubaccountCode: "ACCT_1" })).toBe(false);

    process.env.PAYSTACK_SECRET_KEY = "sk_test_example";
    expect(isPaystackCheckoutReady({ allowCard: false, paystackSubaccountCode: "ACCT_1" })).toBe(false);
    expect(isPaystackCheckoutReady({ allowCard: true, paystackSubaccountCode: null })).toBe(false);
    expect(isPaystackCheckoutReady({ allowCard: true, paystackSubaccountCode: "wrong-account" })).toBe(false);
    expect(isPaystackCheckoutReady({ allowCard: true, paystackSubaccountCode: "ACCT_1" })).toBe(true);
  });

  it("initializes communication credits on the administrator account without a shop subaccount", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_platform";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { authorization_url: "https://checkout.test/credit", reference: "EJM-CRED-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await initializePlatformPaystackTransaction({
      email: "owner@example.com",
      amount: 80,
      currency: "GHS",
      reference: "EJM-CRED-1",
      callbackUrl: "https://ejm.test/api/paystack/communication-credits/callback",
      metadata: { shop_id: "shop-a" },
    });

    expect(result.authorizationUrl).toBe("https://checkout.test/credit");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.amount).toBe(8000);
    expect(body).not.toHaveProperty("subaccount");
    expect(body).not.toHaveProperty("transaction_charge");
    expect(body.metadata).toMatchObject({
      shop_id: "shop-a",
      settlement_owner: "ejm_administrator",
      platform_account: "ejm_administrator",
      purchase_type: "communication_credits",
    });
  });

  it("initializes subscription invoices on the administrator account with an explicit purchase type", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_platform";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { authorization_url: "https://checkout.test/subscription", reference: "EJM-SUB-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await initializePlatformPaystackTransaction({
      email: "owner@example.com",
      amount: 150,
      currency: "GHS",
      reference: "EJM-SUB-1",
      callbackUrl: "https://ejm.test/api/paystack/subscriptions/callback",
      purchaseType: "subscription_invoice",
      metadata: { subscription_invoice_id: "invoice-a", purchase_type: "tampered" },
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { metadata: Record<string, unknown> };
    expect(body.metadata).toMatchObject({
      subscription_invoice_id: "invoice-a",
      settlement_owner: "ejm_administrator",
      platform_account: "ejm_administrator",
      purchase_type: "subscription_invoice",
    });
  });

  it("normalizes legacy fee-bearer values to safe Paystack choices", () => {
    expect(normalizePaystackChargeBearer("account")).toBe("account");
    expect(normalizePaystackChargeBearer("subaccount")).toBe("subaccount");
    expect(normalizePaystackChargeBearer("all")).toBe("subaccount");
    expect(normalizePaystackChargeBearer("all-proportional")).toBe("subaccount");
    expect(normalizePaystackChargeBearer(null)).toBe("subaccount");
  });

  it("accepts only valid webhook signatures", () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_webhook";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
    const good = createHmac("sha512", "sk_test_webhook").update(body).digest("hex");
    const bad = createHmac("sha512", "sk_test_other").update(body).digest("hex");

    expect(verifyPaystackWebhookSignature(body, good)).toBe(true);
    expect(verifyPaystackWebhookSignature(body, bad)).toBe(false);
    expect(verifyPaystackWebhookSignature(body, null)).toBe(false);
    expect(verifyPaystackWebhookSignature(body, "not-hex")).toBe(false);
  });
});
