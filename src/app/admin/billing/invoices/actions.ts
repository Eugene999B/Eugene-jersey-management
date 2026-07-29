"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform-admin";
import {
  ensureSubscriptionRenewalInvoice,
  markSubscriptionInvoicePaidManually,
  processSubscriptionInvoices,
  reconcileSubscriptionPaymentAttempt,
  sendSubscriptionInvoiceReminder,
  SubscriptionBillingError,
  voidSubscriptionInvoice,
} from "@/lib/subscription-billing";

const shopSchema = z.object({ shopId: z.string().min(1).max(120) });
const invoiceReasonSchema = z.object({ invoiceId: z.string().min(1).max(120), reason: z.string().trim().min(8).max(500) });
const invoiceSchema = z.object({ invoiceId: z.string().min(1).max(120) });
const attemptSchema = z.object({ attemptId: z.string().min(1).max(120) });

function billingRedirect(error: string): never {
  redirect(`/admin/billing/invoices?error=${encodeURIComponent(error)}`);
}

function refresh() {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/billing/invoices");
  revalidatePath("/dashboard/subscription");
}

export async function issueSubscriptionInvoiceAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = shopSchema.safeParse({ shopId: formData.get("shopId") });
  if (!parsed.success) billingRedirect("shop-invalid");
  const invoice = await ensureSubscriptionRenewalInvoice({
    shopId: parsed.data.shopId,
    createdById: session.id,
    force: true,
  }).catch((error) => {
    if (error instanceof SubscriptionBillingError) billingRedirect(error.code);
    throw error;
  });
  if (!invoice) billingRedirect("invoice-unavailable");
  refresh();
  redirect(`/admin/billing/invoices?issued=${encodeURIComponent(invoice.id)}`);
}

export async function markSubscriptionInvoicePaidAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = invoiceReasonSchema.safeParse({ invoiceId: formData.get("invoiceId"), reason: formData.get("reason") });
  if (!parsed.success) billingRedirect("reason-invalid");
  await markSubscriptionInvoicePaidManually({
    invoiceId: parsed.data.invoiceId,
    adminId: session.id,
    reason: parsed.data.reason,
  }).catch((error) => {
    if (error instanceof SubscriptionBillingError) billingRedirect(error.code);
    throw error;
  });
  refresh();
  redirect(`/admin/billing/invoices?paid=${encodeURIComponent(parsed.data.invoiceId)}`);
}

export async function voidSubscriptionInvoiceAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = invoiceReasonSchema.safeParse({ invoiceId: formData.get("invoiceId"), reason: formData.get("reason") });
  if (!parsed.success) billingRedirect("reason-invalid");
  await voidSubscriptionInvoice({ invoiceId: parsed.data.invoiceId, adminId: session.id, reason: parsed.data.reason }).catch((error) => {
    if (error instanceof SubscriptionBillingError) billingRedirect(error.code);
    throw error;
  });
  refresh();
  redirect(`/admin/billing/invoices?voided=${encodeURIComponent(parsed.data.invoiceId)}`);
}

export async function sendSubscriptionReminderAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = invoiceSchema.safeParse({ invoiceId: formData.get("invoiceId") });
  if (!parsed.success) billingRedirect("invoice-invalid");
  const result = await sendSubscriptionInvoiceReminder({ invoiceId: parsed.data.invoiceId, initiatedById: session.id, force: true });
  if (!result.sent) billingRedirect(`reminder-${result.reason}`);
  refresh();
  redirect(`/admin/billing/invoices?reminded=${encodeURIComponent(parsed.data.invoiceId)}`);
}

export async function reconcileSubscriptionPaymentAction(formData: FormData) {
  await requirePlatformPermission("billing");
  const parsed = attemptSchema.safeParse({ attemptId: formData.get("attemptId") });
  if (!parsed.success) billingRedirect("attempt-invalid");
  const result = await reconcileSubscriptionPaymentAttempt(parsed.data.attemptId).catch((error) => {
    if (error instanceof SubscriptionBillingError) billingRedirect(error.code);
    throw error;
  });
  if (result.status !== "processed") billingRedirect(`reconcile-${result.reason}`);
  refresh();
  redirect(`/admin/billing/invoices?reconciled=${encodeURIComponent(parsed.data.attemptId)}`);
}

export async function processSubscriptionBillingAction() {
  await requirePlatformPermission("billing");
  const result = await processSubscriptionInvoices();
  refresh();
  redirect(`/admin/billing/invoices?processed=${encodeURIComponent(`${result.created}-${result.reminded}`)}`);
}
