"use server";

import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  createSubscriptionPaymentCheckout,
  ensureSubscriptionRenewalInvoice,
  SubscriptionBillingError,
} from "@/lib/subscription-billing";

const invoiceSchema = z.object({ invoiceId: z.string().min(1).max(120) });

function subscriptionRedirect(error: string): never {
  redirect(`/dashboard/subscription?error=${encodeURIComponent(error)}`);
}

export async function generateSubscriptionInvoiceAction() {
  const session = await requireRole([Role.OWNER]);
  if (!session.shopId) subscriptionRedirect("missing-shop");
  const invoice = await ensureSubscriptionRenewalInvoice({
    shopId: session.shopId,
    createdById: session.id,
    force: true,
  }).catch((error) => {
    if (error instanceof SubscriptionBillingError) subscriptionRedirect(error.code);
    throw error;
  });
  if (!invoice) subscriptionRedirect("invoice-unavailable");
  revalidatePath("/dashboard/subscription");
  redirect(`/dashboard/subscription?invoice=${encodeURIComponent(invoice.id)}&generated=1`);
}

export async function startSubscriptionPaymentAction(formData: FormData) {
  const session = await requireRole([Role.OWNER]);
  if (!session.shopId) subscriptionRedirect("missing-shop");
  const parsed = invoiceSchema.safeParse({ invoiceId: formData.get("invoiceId") });
  if (!parsed.success) subscriptionRedirect("invoice-invalid");

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const attempt = await createSubscriptionPaymentCheckout({
    shopId: session.shopId,
    invoiceId: parsed.data.invoiceId,
    userId: session.id,
    email: session.email,
    callbackUrl: `${appUrl}/api/paystack/subscriptions/callback`,
  }).catch((error) => {
    if (error instanceof SubscriptionBillingError) subscriptionRedirect(error.code);
    throw error;
  });
  if (!attempt.authorizationUrl) subscriptionRedirect("checkout-failed");
  redirect(attempt.authorizationUrl);
}
