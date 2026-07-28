import { NextRequest, NextResponse } from "next/server";
import { settleCommunicationCreditPurchase } from "@/lib/communication-credits";
import { communicationCreditPurchaseByReference } from "@/lib/communication-credit-purchases";
import { verifyPaystackTransaction } from "@/lib/payments";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") || request.nextUrl.searchParams.get("trxref");
  if (!reference) return NextResponse.redirect(new URL("/dashboard/messages?credits=invalid", request.url), 303);

  const purchase = await communicationCreditPurchaseByReference(reference);
  if (!purchase) return NextResponse.redirect(new URL("/dashboard/messages?credits=failed", request.url), 303);
  const verified = await verifyPaystackTransaction(reference);
  if (!verified) return NextResponse.redirect(new URL("/dashboard/messages?credits=failed", request.url), 303);

  const result = await settleCommunicationCreditPurchase(verified);
  const target = new URL("/dashboard/messages", request.url);
  target.searchParams.set("credits", result.status === "processed" ? "success" : "failed");
  target.searchParams.set("channel", purchase.channel);
  return NextResponse.redirect(target, 303);
}
