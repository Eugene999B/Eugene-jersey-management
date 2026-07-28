"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  CommunicationCreditPurchaseError,
  createPendingCommunicationCreditPurchase,
  failCommunicationCreditPurchase,
} from "@/lib/communication-credit-purchases";
import { initializePlatformPaystackTransaction } from "@/lib/payments";
import { permissions } from "@/lib/rbac";

const purchaseSchema = z.object({ packageId: z.string().min(1) });

function messagesRedirect(error: string): never {
  redirect(`/dashboard/messages?error=${encodeURIComponent(error)}`);
}

export async function purchaseCommunicationCreditsAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = purchaseSchema.safeParse({ packageId: formData.get("packageId") });
  if (!parsed.success) messagesRedirect("credit-package");

  const purchase = await createPendingCommunicationCreditPurchase({
    shopId: session.shopId,
    packageId: parsed.data.packageId,
    initiatedById: session.id,
  }).catch((error) => {
    if (error instanceof CommunicationCreditPurchaseError) messagesRedirect("credit-package");
    throw error;
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "communication_credit.purchase_initiated",
    entityType: "CommunicationCreditPurchase",
    entityId: purchase.id,
    metadata: {
      packageId: purchase.packageId,
      packageVersion: purchase.packageVersion,
      channel: purchase.channel,
      totalUnits: purchase.totalUnits,
      amount: purchase.amount.toString(),
      currency: purchase.currency,
      providerReference: purchase.providerReference,
    },
  });

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  try {
    const initialized = await initializePlatformPaystackTransaction({
      email: session.email,
      amount: Number(purchase.amount),
      currency: purchase.currency,
      reference: purchase.providerReference,
      callbackUrl: `${appUrl}/api/paystack/communication-credits/callback`,
      metadata: {
        communication_credit_purchase_id: purchase.id,
        shop_id: session.shopId,
        package_id: purchase.packageId,
        package_version: purchase.packageVersion,
        channel: purchase.channel,
        units: purchase.totalUnits,
      },
    });
    if (!initialized.providerEnabled || !initialized.authorizationUrl) {
      await failCommunicationCreditPurchase({ purchaseId: purchase.id, reason: "Paystack is not configured." });
      messagesRedirect("credit-paystack-unavailable");
    }
    redirect(initialized.authorizationUrl);
  } catch (error) {
    await failCommunicationCreditPurchase({
      purchaseId: purchase.id,
      reason: error instanceof Error ? error.message.slice(0, 500) : "Paystack initialization failed.",
    });
    messagesRedirect("credit-checkout");
  }
}
