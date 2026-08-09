import { CustomerProductionRequestStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getBuyerSession } from "@/lib/buyer-session";
import { customerProductionBalance, paidOrderAmount } from "@/lib/customer-production";
import { prisma } from "@/lib/db";
import { initializePaystackTransaction, isPaystackCheckoutReady } from "@/lib/payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

function appOrigin(request: NextRequest) {
  const configured = process.env.APP_URL?.trim();
  if (!configured) return request.nextUrl.origin;
  try { return new URL(configured).origin; } catch { return request.nextUrl.origin; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await context.params;
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const buyer = await getBuyerSession();
  if (!buyer) return NextResponse.redirect(new URL(`/buyer/login?next=${encodeURIComponent(`/buyer/production-requests/${requestId}`)}`, request.url), 303);
  await enforceRateLimit({ key: `custom-production-payment:${buyer.id}`, limit: 12, windowSeconds: 60 * 60 }).catch(() => null);

  const form = await request.formData();
  const stage = String(form.get("stage") ?? "DEPOSIT").toUpperCase();
  if (stage !== "DEPOSIT" && stage !== "BALANCE") return NextResponse.redirect(new URL(`/buyer/production-requests/${requestId}?error=payment-stage`, request.url), 303);

  const productionRequest = await prisma.customerProductionRequest.findFirst({
    where: { id: requestId, buyerId: buyer.id },
    include: undefined,
  });
  if (!productionRequest?.orderId || productionRequest.quotedTotal === null || productionRequest.depositAmount === null || productionRequest.status === CustomerProductionRequestStatus.CANCELLED) {
    return NextResponse.redirect(new URL(`/buyer/production-requests/${requestId}?error=payment-not-ready`, request.url), 303);
  }
  const [shop, buyerAccount, order] = await Promise.all([
    prisma.shop.findUnique({ where: { id: productionRequest.shopId }, include: { paymentConfig: true } }),
    prisma.buyerAccount.findUnique({ where: { id: buyer.id } }),
    prisma.order.findFirst({ where: { id: productionRequest.orderId, shopId: productionRequest.shopId, buyerId: buyer.id }, include: { payments: true } }),
  ]);
  if (!shop?.isActive || !buyerAccount?.isActive || !order || !isPaystackCheckoutReady(shop.paymentConfig)) {
    return NextResponse.redirect(new URL(`/buyer/production-requests/${requestId}?error=payment-unavailable`, request.url), 303);
  }

  const paidAmount = paidOrderAmount(order.payments);
  const amounts = customerProductionBalance({ quotedTotal: Number(productionRequest.quotedTotal), depositAmount: Number(productionRequest.depositAmount), paidAmount });
  if (stage === "BALANCE" && !amounts.depositSatisfied) return NextResponse.redirect(new URL(`/buyer/production-requests/${requestId}?error=deposit-first`, request.url), 303);
  const amount = stage === "DEPOSIT" ? amounts.depositDue : amounts.balanceDue;
  if (amount <= 0.005) return NextResponse.redirect(new URL(`/buyer/production-requests/${requestId}?payment=already-paid`, request.url), 303);

  const reference = `CUSTOM-${stage}-${Date.now()}-${nanoid(8)}`;
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      method: PaymentMethod.CARD,
      amount,
      status: PaymentStatus.PENDING,
      providerReference: reference,
      metadata: { customerProductionRequestId: productionRequest.id, paymentStage: stage },
    },
  });
  const callback = new URL("/api/customer-production-paystack/callback", appOrigin(request));
  callback.searchParams.set("requestId", productionRequest.id);
  try {
    const initialized = await initializePaystackTransaction({
      email: buyerAccount.email ?? `${buyerAccount.id}@customer.local`,
      amount,
      currency: shop.currency,
      reference,
      callbackUrl: callback.toString(),
      subaccount: shop.paymentConfig?.paystackSubaccountCode,
      transactionCharge: shop.paymentConfig?.paystackTransactionCharge,
      bearer: shop.paymentConfig?.paystackChargeBearer,
      metadata: { orderId: order.id, shopId: shop.id, receiptNumber: order.receiptNumber, customerProductionRequestId: productionRequest.id, paymentStage: stage },
    });
    if (!initialized.authorizationUrl) throw new Error("PAYSTACK_URL_MISSING");
    return NextResponse.redirect(initialized.authorizationUrl, 303);
  } catch {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, gatewayResponse: "Checkout initialization failed." } });
    return NextResponse.redirect(new URL(`/buyer/production-requests/${requestId}?error=payment-init`, request.url), 303);
  }
}
