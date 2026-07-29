import { NextRequest, NextResponse } from "next/server";
import { platformDb } from "@/lib/platform-db";
import { verifyPaystackTransaction } from "@/lib/payments";
import { settleSubscriptionInvoicePayment } from "@/lib/subscription-billing";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") || request.nextUrl.searchParams.get("trxref");
  if (!reference) return NextResponse.redirect(new URL("/dashboard/subscription?payment=invalid", request.url), 303);

  const verified = await verifyPaystackTransaction(reference);
  if (!verified) return NextResponse.redirect(new URL("/dashboard/subscription?payment=failed", request.url), 303);
  const result = await settleSubscriptionInvoicePayment(verified);
  const attempt = await platformDb.subscriptionPaymentAttempt.findUnique({
    where: { reference },
    select: { invoiceId: true },
  });
  const target = new URL("/dashboard/subscription", request.url);
  target.searchParams.set("payment", result.status === "processed" ? "success" : "failed");
  if (attempt?.invoiceId) target.searchParams.set("invoice", attempt.invoiceId);
  return NextResponse.redirect(target, 303);
}
