import {
  CustomerProductionEventType,
  CustomerProductionRequestStatus,
  PaymentStatus,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { customerProductionBalance, paidOrderAmount } from "@/lib/customer-production";
import { prisma } from "@/lib/db";
import { settlePaystackTransaction, verifyPaystackTransaction } from "@/lib/payments";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") || request.nextUrl.searchParams.get("trxref");
  const requestedId = request.nextUrl.searchParams.get("requestId");
  if (!reference) return NextResponse.redirect(new URL(`/buyer/production-requests/${encodeURIComponent(requestedId ?? "")}?error=payment-invalid`, request.url), 303);

  const verified = await verifyPaystackTransaction(reference);
  if (!verified) return NextResponse.redirect(new URL(`/buyer/production-requests/${encodeURIComponent(requestedId ?? "")}?error=payment-failed`, request.url), 303);
  const result = await settlePaystackTransaction(verified);
  const payment = await prisma.payment.findFirst({ where: { providerReference: reference }, include: { order: { include: { payments: true } } } });
  if (!payment?.order) return NextResponse.redirect(new URL("/shops?payment=failed", request.url), 303);
  const productionRequest = await prisma.customerProductionRequest.findFirst({ where: { orderId: payment.order.id, ...(requestedId ? { id: requestedId } : {}) } });
  if (!productionRequest || productionRequest.quotedTotal === null || productionRequest.depositAmount === null) return NextResponse.redirect(new URL("/shops?payment=failed", request.url), 303);

  if (result.status === "processed" && payment.status === PaymentStatus.SUCCESS) {
    const paidAmount = paidOrderAmount(payment.order.payments.map((row) => row.id === payment.id ? { ...row, status: PaymentStatus.SUCCESS } : row));
    const amounts = customerProductionBalance({ quotedTotal: Number(productionRequest.quotedTotal), depositAmount: Number(productionRequest.depositAmount), paidAmount });
    await prisma.$transaction(async (tx) => {
      const current = await tx.customerProductionRequest.findUnique({ where: { id: productionRequest.id } });
      if (!current) return;
      const data: {
        depositPaidAt?: Date;
        balancePaidAt?: Date;
        status?: CustomerProductionRequestStatus;
      } = {};
      const events: Array<{ shopId: string; requestId: string; type: CustomerProductionEventType; note: string; actorBuyerId: string }> = [];
      if (amounts.depositSatisfied && !current.depositPaidAt) {
        data.depositPaidAt = new Date();
        if (current.status === CustomerProductionRequestStatus.APPROVED) data.status = CustomerProductionRequestStatus.DEPOSIT_PAID;
        events.push({ shopId: current.shopId, requestId: current.id, type: CustomerProductionEventType.DEPOSIT_PAID, note: `Deposit milestone reached. Paid ${paidAmount.toFixed(2)} against the order.`, actorBuyerId: current.buyerId });
      }
      if (amounts.fullyPaid && !current.balancePaidAt) {
        data.balancePaidAt = new Date();
        events.push({ shopId: current.shopId, requestId: current.id, type: CustomerProductionEventType.BALANCE_PAID, note: "Order balance fully paid.", actorBuyerId: current.buyerId });
      }
      if (Object.keys(data).length) await tx.customerProductionRequest.update({ where: { id: current.id }, data });
      if (events.length) await tx.customerProductionEvent.createMany({ data: events });
    });
  }

  const target = new URL(`/buyer/production-requests/${productionRequest.id}`, request.url);
  target.searchParams.set("payment", result.status === "processed" ? "success" : "failed");
  return NextResponse.redirect(target, 303);
}
