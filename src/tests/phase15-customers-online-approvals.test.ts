import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCustomerProductionPreview,
  customerArtworkBytesMatchMime,
  customerArtworkMimeAllowed,
  customerProductionBalance,
  MAX_CUSTOMER_ARTWORK_BYTES,
} from "@/lib/customer-production";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 15 customers, online ordering and approvals", () => {
  it("accepts only bounded real JPEG PNG and WebP artwork signatures", () => {
    expect(MAX_CUSTOMER_ARTWORK_BYTES).toBe(5 * 1024 * 1024);
    expect(customerArtworkMimeAllowed("image/jpeg")).toBe(true);
    expect(customerArtworkMimeAllowed("image/png")).toBe(true);
    expect(customerArtworkMimeAllowed("image/webp")).toBe(true);
    expect(customerArtworkMimeAllowed("text/html")).toBe(false);
    expect(customerArtworkBytesMatchMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")).toBe(true);
    expect(customerArtworkBytesMatchMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(customerArtworkBytesMatchMime(new TextEncoder().encode("RIFFxxxxWEBP"), "image/webp")).toBe(true);
    expect(customerArtworkBytesMatchMime(new TextEncoder().encode("<script>alert(1)</script>"), "image/png")).toBe(false);
  });

  it("calculates deposit and balance from verified paid amount", () => {
    expect(customerProductionBalance({ quotedTotal: 100, depositAmount: 30, paidAmount: 0 })).toEqual({
      quotedTotal: 100,
      depositAmount: 30,
      paidAmount: 0,
      depositDue: 30,
      balanceDue: 100,
      depositSatisfied: false,
      fullyPaid: false,
    });
    const deposited = customerProductionBalance({ quotedTotal: 100, depositAmount: 30, paidAmount: 30 });
    expect(deposited.depositSatisfied).toBe(true);
    expect(deposited.balanceDue).toBe(70);
    expect(customerProductionBalance({ quotedTotal: 100, depositAmount: 0, paidAmount: 0 }).depositSatisfied).toBe(true);
    expect(customerProductionBalance({ quotedTotal: 100, depositAmount: 30, paidAmount: 100 }).fullyPaid).toBe(true);
  });

  it("escapes customer text in generated concept previews", () => {
    const svg = buildCustomerProductionPreview({
      title: "Team <Final>",
      garment: { name: "Cotton tee", colour: "Black", garmentType: "T-shirt" },
      size: "M",
      placement: { name: "Left chest", location: "LEFT_CHEST" },
      requestedText: '<script>alert("x")</script>',
      requestedNumber: "10",
      previewNote: "Approve spelling & placement",
    });
    expect(svg).toContain("Team &lt;Final&gt;");
    expect(svg).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(svg).not.toContain("<script>alert");
    expect(svg).toContain("10");
    expect(svg).toContain("Left chest");
  });

  it("adds the customer request lifecycle without destructive migration", () => {
    const migration = source("../../prisma/migrations/20260809120000_phase15_customer_online_approvals/migration.sql");
    expect(migration).toContain('CREATE TABLE "CustomerProductionRequest"');
    expect(migration).toContain('CREATE TABLE "CustomerProductionAsset"');
    expect(migration).toContain('CREATE TABLE "CustomerProductionEvent"');
    expect(migration).toContain('CREATE UNIQUE INDEX "CustomerProductionRequest_publicAccessToken_key"');
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("DELETE FROM");
    expect(migration).not.toContain('ALTER TABLE "Order"');
  });

  it("requires buyer identity, same-shop customizable options and production snapshots at submission", () => {
    const action = source("../app/shop/[slug]/custom-production/actions.ts");
    expect(action).toContain("getBuyerSession");
    expect(action).toContain('product: { shopId: shop.id, isPersonalizable: true }');
    expect(action).toContain("readProductionLibrary(shop.productionSetup)");
    expect(action).toContain("item.sizes.includes(garmentSize)");
    expect(action).toContain("item.garmentId === garmentResourceId");
    expect(action).toContain("customerArtworkBytesMatchMime");
    expect(action).toContain("productSnapshot: jsonSnapshot");
    expect(action).toContain("garmentSnapshot: jsonSnapshot(garment)");
    expect(action).toContain("placementSnapshot: jsonSnapshot(placement)");
    expect(action).toContain("CommercialSubscriptionError");
  });

  it("creates the financial order only after explicit preview approval and handles zero deposit", () => {
    const actions = source("../app/buyer/production-requests/[requestId]/actions.ts");
    expect(actions).toContain("locked.status !== CustomerProductionRequestStatus.PREVIEW_READY");
    expect(actions).toContain("idempotencyKey: `custom-request:${locked.id}`");
    expect(actions).toContain("CustomerProductionEventType.APPROVED");
    expect(actions).toContain("CustomerProductionEventType.ORDER_CREATED");
    expect(actions).toContain("const zeroDeposit = deposit <= 0.005");
    expect(actions).toContain("CustomerProductionRequestStatus.DEPOSIT_PAID");
    expect(actions).toContain("No deposit was required");
  });

  it("uses the existing verified payment ledger for deposit and balance", () => {
    const payment = source("../app/api/customer-production-requests/[requestId]/payment/route.ts");
    const callback = source("../app/api/customer-production-paystack/callback/route.ts");
    expect(payment).toContain("paidOrderAmount(order.payments)");
    expect(payment).toContain('stage === "BALANCE" && !amounts.depositSatisfied');
    expect(payment).toContain("PaymentStatus.PENDING");
    expect(payment).toContain("initializePaystackTransaction");
    expect(payment).toContain("Too many custom-production payment attempts");
    expect(callback).toContain("verifyPaystackTransaction(reference)");
    expect(callback).toContain("settlePaystackTransaction(verified)");
    expect(callback).toContain("CustomerProductionEventType.DEPOSIT_PAID");
    expect(callback).toContain("CustomerProductionEventType.BALANCE_PAID");
  });

  it("blocks production before deposit and completion before full payment while mirroring Order status", () => {
    const actions = source("../app/dashboard/customer-production/actions.ts");
    expect(actions).toContain("request.status !== CustomerProductionRequestStatus.DEPOSIT_PAID");
    expect(actions).toContain("!request.depositPaidAt");
    expect(actions).toContain("request.status !== CustomerProductionRequestStatus.READY");
    expect(actions).toContain("!request.balancePaidAt");
    expect(actions).toContain("OrderStatus.IN_PRODUCTION");
    expect(actions).toContain("OrderStatus.READY");
    expect(actions).toContain("OrderStatus.COMPLETED");
    expect(actions).toContain("sendCustomerMessage");
  });

  it("keeps artwork private behind request access tokens and hard response headers", () => {
    const route = source("../app/api/customer-production-assets/[assetId]/route.ts");
    expect(route).toContain("publicAccessToken: access");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    expect(route).toContain('"Content-Security-Policy": "default-src \'none\'; sandbox"');
  });

  it("generalizes the verified marketplace without inventing distance precision", () => {
    const marketplace = source("../app/shops/page.tsx");
    expect(marketplace).toContain('type MarketplaceOffer = "ALL" | "PRODUCT" | "SERVICE" | "RENTAL" | "CUSTOM"');
    expect(marketplace).toContain('if (offer === "SERVICE") return { isService: true }');
    expect(marketplace).toContain('if (offer === "RENTAL") return { isRentable: true }');
    expect(marketplace).toContain('if (offer === "CUSTOM") return { isPersonalizable: true }');
    expect(marketplace).toContain("product.isPersonalizable");
    expect(marketplace).toContain("custom-production?product=");
    expect(marketplace).toContain("Distance ranking appears only when businesses have usable coordinates");
    expect(marketplace).toContain("verified Ghana registration location");
  });

  it("exposes buyer approval/payment tracking and staff request operations", () => {
    const buyerPage = source("../app/buyer/production-requests/[requestId]/page.tsx");
    const staffPage = source("../app/dashboard/customer-production/page.tsx");
    expect(buyerPage).toContain("Approve preview & create order");
    expect(buyerPage).toContain("Pay deposit");
    expect(buyerPage).toContain("Pay remaining balance");
    expect(buyerPage).toContain("Production tracking");
    expect(staffPage).toContain("Issue quoted preview");
    expect(staffPage).toContain("Start production");
    expect(staffPage).toContain("Mark ready & notify customer");
    expect(staffPage).toContain("Complete & notify customer");
  });
});
