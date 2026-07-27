import { createHmac } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  amountToSubunit,
  isPaystackCheckoutReady,
  normalizePaystackChargeBearer,
  verifyPaystackWebhookSignature,
} from "@/lib/payments";

describe("Paystack helpers", () => {
  const previousKey = process.env.PAYSTACK_SECRET_KEY;

  afterEach(() => {
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
