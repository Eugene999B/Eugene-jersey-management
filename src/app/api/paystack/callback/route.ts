import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settlePaystackTransaction, verifyPaystackTransaction } from "@/lib/payments";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") || request.nextUrl.searchParams.get("trxref");
  if (!reference) return NextResponse.redirect(new URL("/shops?payment=invalid", request.url), 303);

  const verified = await verifyPaystackTransaction(reference);
  if (!verified) return NextResponse.redirect(new URL("/shops?payment=failed", request.url), 303);
  const result = await settlePaystackTransaction(verified);
  const payment = await prisma.payment.findFirst({
    where: { providerReference: reference },
    include: { order: true },
  });
  if (!payment?.order) return NextResponse.redirect(new URL("/shops?payment=failed", request.url), 303);

  const target = new URL(`/track/${payment.order.receiptNumber}`, request.url);
  target.searchParams.set("access", payment.order.publicAccessToken);
  target.searchParams.set("payment", result.status === "processed" ? "success" : "failed");
  return NextResponse.redirect(target, 303);
}
