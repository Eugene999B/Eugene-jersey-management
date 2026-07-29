import fs from "node:fs";

function replaceOrFail(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected patch anchor was not found in ${file}: ${before.slice(0, 120)}`);
  }
  fs.writeFileSync(file, source.replace(before, after), "utf8");
}

replaceOrFail(
  "src/app/dashboard/catalog/actions.ts",
  'import { productVariantAttributes, productVariantSize } from "@/lib/product-variants";\n',
  'import { productVariantAttributes, productVariantSize } from "@/lib/product-variants";\nimport { assertProductCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";\n',
);

replaceOrFail(
  "src/app/dashboard/catalog/actions.ts",
  `  if (!parsed.success || !variants) redirect("/dashboard/catalog?error=product");\n\n  const category = await resolveCategory(session.shopId, parsed.data.categoryId);`,
  `  if (!parsed.success || !variants) redirect("/dashboard/catalog?error=product");\n\n  try {\n    await assertProductCreationAvailable(session.shopId);\n  } catch (error) {\n    const commercial = commercialSubscriptionError(error);\n    if (commercial?.code === "PRODUCT_LIMIT_REACHED") redirect("/dashboard/catalog?error=plan-product-limit");\n    if (commercial?.code === "FEATURE_NOT_INCLUDED") redirect("/dashboard/catalog?error=plan-feature");\n    if (commercial) redirect("/dashboard/catalog?error=subscription-blocked");\n    throw error;\n  }\n\n  const category = await resolveCategory(session.shopId, parsed.data.categoryId);`,
);

replaceOrFail(
  "src/app/dashboard/catalog/actions.ts",
  `  } catch {\n    redirect("/dashboard/catalog?error=sku-exists");\n  }`,
  `  } catch (error) {\n    const commercial = commercialSubscriptionError(error);\n    if (commercial?.code === "PRODUCT_LIMIT_REACHED") redirect("/dashboard/catalog?error=plan-product-limit");\n    if (commercial?.code === "FEATURE_NOT_INCLUDED") redirect("/dashboard/catalog?error=plan-feature");\n    if (commercial) redirect("/dashboard/catalog?error=subscription-blocked");\n    redirect("/dashboard/catalog?error=sku-exists");\n  }`,
);

replaceOrFail(
  "src/app/dashboard/catalog/page.tsx",
  `  "sku-exists": "One of the SKUs is already being used. Leave SKU blank for automatic generation or enter a unique value.",\n};`,
  `  "sku-exists": "One of the SKUs is already being used. Leave SKU blank for automatic generation or enter a unique value.",\n  "plan-product-limit": "This shop has reached the product limit in its assigned plan. Review Subscription & usage before creating another product.",\n  "plan-feature": "Inventory and product creation are not included in this shop's assigned plan.",\n  "subscription-blocked": "This shop's subscription term or grace period prevents new commercial changes. Review Subscription & usage.",\n};`,
);

replaceOrFail(
  "src/app/api/pos/checkout/route.ts",
  'import { DebtStatus, NotificationChannel, PaymentMethod, PaymentStatus, OrderStatus, Role } from "@prisma/client";',
  'import { DebtStatus, NotificationChannel, OrderChannel, PaymentMethod, PaymentStatus, OrderStatus, Role } from "@prisma/client";',
);

replaceOrFail(
  "src/app/api/pos/checkout/route.ts",
  'import { isTrustedApplicationOrigin } from "@/lib/request-origin";\n',
  'import { isTrustedApplicationOrigin } from "@/lib/request-origin";\nimport { assertOrderCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";\n',
);

replaceOrFail(
  "src/app/api/pos/checkout/route.ts",
  `  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: session.shopId } });\n  const selectedCustomer`,
  `  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: session.shopId } });\n  try {\n    await assertOrderCreationAvailable({ shopId: session.shopId, channel: OrderChannel.POS });\n  } catch (error) {\n    const commercial = commercialSubscriptionError(error);\n    if (commercial) return NextResponse.json({ error: commercial.message, code: commercial.code }, { status: 409 });\n    throw error;\n  }\n  const selectedCustomer`,
);

replaceOrFail(
  "src/app/api/pos/checkout/route.ts",
  `    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {\n      return NextResponse.json({ error: "Stock changed while checking out. Refresh and try again." }, { status: 409 });\n    }\n    throw error;`,
  `    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {\n      return NextResponse.json({ error: "Stock changed while checking out. Refresh and try again." }, { status: 409 });\n    }\n    const commercial = commercialSubscriptionError(error);\n    if (commercial) return NextResponse.json({ error: commercial.message, code: commercial.code }, { status: 409 });\n    throw error;`,
);

replaceOrFail(
  "src/app/api/public-order/route.ts",
  'import { releaseUnpaidOnlineReservation } from "@/lib/order-lifecycle";\n',
  'import { releaseUnpaidOnlineReservation } from "@/lib/order-lifecycle";\nimport { assertOrderCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";\n',
);

replaceOrFail(
  "src/app/api/public-order/route.ts",
  `  const duplicateOrder = await prisma.order.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });\n  if (duplicateOrder) {\n    if (duplicateOrder.buyerId === buyer.id) return redirectTo(request, \`/track/\${duplicateOrder.receiptNumber}?access=\${encodeURIComponent(duplicateOrder.publicAccessToken)}\`);\n    return redirectTo(request, \`/shop/\${shop.slug}?error=duplicate-request\`);\n  }\n\n  const variant`,
  `  const duplicateOrder = await prisma.order.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });\n  if (duplicateOrder) {\n    if (duplicateOrder.buyerId === buyer.id) return redirectTo(request, \`/track/\${duplicateOrder.receiptNumber}?access=\${encodeURIComponent(duplicateOrder.publicAccessToken)}\`);\n    return redirectTo(request, \`/shop/\${shop.slug}?error=duplicate-request\`);\n  }\n\n  try {\n    await assertOrderCreationAvailable({ shopId: shop.id, channel: OrderChannel.ONLINE });\n  } catch (error) {\n    if (commercialSubscriptionError(error)) return redirectTo(request, \`/shop/\${shop.slug}?error=subscription\`);\n    throw error;\n  }\n\n  const variant`,
);

replaceOrFail(
  "src/app/api/public-order/route.ts",
  `    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return redirectTo(request, \`/shop/\${shop.slug}?error=stock\`);\n    if (error instanceof Prisma.PrismaClientKnownRequestError`,
  `    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return redirectTo(request, \`/shop/\${shop.slug}?error=stock\`);\n    if (commercialSubscriptionError(error)) return redirectTo(request, \`/shop/\${shop.slug}?error=subscription\`);\n    if (error instanceof Prisma.PrismaClientKnownRequestError`,
);

replaceOrFail(
  "src/app/cart/actions.ts",
  'import { enforceRateLimit } from "@/lib/rate-limit";\n',
  'import { enforceRateLimit } from "@/lib/rate-limit";\nimport { assertOrderCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";\n',
);

replaceOrFail(
  "src/app/cart/actions.ts",
  `  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled) redirect("/cart?error=closed");\n  if (parsed.data.paymentChoice`,
  `  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled) redirect("/cart?error=closed");\n  try {\n    await assertOrderCreationAvailable({ shopId: shop.id, channel: OrderChannel.ONLINE });\n  } catch (error) {\n    if (commercialSubscriptionError(error)) redirect("/cart?error=subscription");\n    throw error;\n  }\n  if (parsed.data.paymentChoice`,
);

replaceOrFail(
  "src/app/cart/actions.ts",
  `    if (error instanceof Error && error.message === "COUPON_EXHAUSTED") redirect("/cart?error=coupon");\n    if (error instanceof Prisma.PrismaClientKnownRequestError`,
  `    if (error instanceof Error && error.message === "COUPON_EXHAUSTED") redirect("/cart?error=coupon");\n    if (commercialSubscriptionError(error)) redirect("/cart?error=subscription");\n    if (error instanceof Prisma.PrismaClientKnownRequestError`,
);

replaceOrFail(
  "src/app/shop/[slug]/page.tsx",
  'import { isPaystackCheckoutReady } from "@/lib/payments";\n',
  'import { isPaystackCheckoutReady } from "@/lib/payments";\nimport { commercialSubscriptionState, subscriptionFeatureIncluded } from "@/lib/subscription-hardening";\n',
);

replaceOrFail(
  "src/app/shop/[slug]/page.tsx",
  `  "review-purchase": "Only buyers who purchased this product can review it.",\n};`,
  `  "review-purchase": "Only buyers who purchased this product can review it.",\n  subscription: "This shop's subscription currently prevents new orders. Contact the shop or try again after renewal.",\n};`,
);

replaceOrFail(
  "src/app/shop/[slug]/page.tsx",
  `  if (!shop || !shop.isActive || !shop.storefrontEnabled || shop.verificationStatus !== ShopVerificationStatus.VERIFIED) notFound();\n  const onlinePaymentReady`,
  `  if (!shop || !shop.isActive || !shop.storefrontEnabled || shop.verificationStatus !== ShopVerificationStatus.VERIFIED) notFound();\n  const subscription = await commercialSubscriptionState(shop.id);\n  const subscriptionOrderingReady = subscription.operational && subscriptionFeatureIncluded(subscription, "STOREFRONT");\n  const onlinePaymentReady`,
);

replaceOrFail(
  "src/app/shop/[slug]/page.tsx",
  `  const checkoutReady = shop.publicOrderingEnabled && (onlinePaymentReady || cashReady);`,
  `  const checkoutReady = shop.publicOrderingEnabled && subscriptionOrderingReady && (onlinePaymentReady || cashReady);`,
);

replaceOrFail(
  "src/app/cart/page.tsx",
  `  "delivery-payment": "Delivery orders require online payment. Choose pickup to pay cash.",\n};`,
  `  "delivery-payment": "Delivery orders require online payment. Choose pickup to pay cash.",\n  subscription: "This shop's subscription currently prevents new orders. Contact the shop or try again after renewal.",\n};`,
);

console.log("Release 37 route patches applied.");
