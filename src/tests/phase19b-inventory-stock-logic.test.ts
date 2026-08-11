import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 19B online reservation stock integrity", () => {
  it("only releases sellable stock while an online order is still pending", () => {
    const lifecycle = source("src/lib/order-lifecycle.ts");
    expect(lifecycle).toContain("const cancellableUnpaidStatuses: OrderStatus[] = [OrderStatus.PENDING]");
    expect(lifecycle).toContain("status: OrderStatus.PENDING");
    expect(lifecycle).not.toContain("OrderStatus.IN_PRODUCTION,\n  OrderStatus.READY");
  });

  it("blocks automatic online cancellation once production has started", () => {
    const route = source("src/app/api/orders/[orderId]/status/route.ts");
    expect(route).toContain("order.status !== OrderStatus.PENDING");
    expect(route).toContain("reserved stock cannot be returned automatically");
  });
});

describe("Phase 19B catalog stock concurrency", () => {
  it("uses compare-and-set stock updates instead of overwriting a concurrently changed balance", () => {
    const actions = source("src/app/dashboard/catalog/actions.ts");
    expect(actions).toContain("stockQty: existing.stockQty");
    expect(actions).toContain("throw new Error(\"INVENTORY_CHANGED\")");
    expect(actions).toContain("inventory-changed");
  });
});

describe("Phase 19B existing atomic stock paths", () => {
  it("keeps POS and public checkout deductions conditional on sufficient stock", () => {
    const pos = source("src/app/api/pos/checkout/route.ts");
    const online = source("src/app/api/public-order/route.ts");
    expect(pos).toContain("stockQty: { gte: item.quantity }");
    expect(online).toContain("stockQty: { gte: parsed.data.quantity }");
  });

  it("keeps production inventory movement balances row-locked and non-negative", () => {
    const inventory = source("src/lib/production-inventory.ts");
    expect(inventory).toContain("FOR UPDATE");
    expect(inventory).toContain("if (nextQuantity < -0.0001)");
  });
});
