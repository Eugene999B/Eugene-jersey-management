import "server-only";

import { BillingCycle, NotificationChannel, PaymentStatus, Prisma, SubscriptionInvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { sendDirectMessage } from "@/lib/messaging";
import { amountToSubunit, initializePlatformPaystackTransaction, verifyPaystackTransaction, type PaystackTransactionData } from "@/lib/payments";
import { platformDb } from "@/lib/platform-db";
import { parseSubscriptionPlanSnapshot } from "@/lib/subscription-plans";
import { isEmailDeliveryConfigured, sendTransactionalEmail } from "@/lib/transactional-email";

const INVOICE_LEAD_DAYS = Math.max(1, Math.min(60, Number(process.env.SUBSCRIPTION_INVOICE_LEAD_DAYS ?? 14)));
const PENDING_CHECKOUT_MINUTES = 30;

export class SubscriptionBillingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SubscriptionBillingError";
  }
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

export function addBillingPeriod(value: Date, cycle: BillingCycle) {
  const next = new Date(value);
  if (cycle === BillingCycle.YEARLY) next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function subscriptionInvoiceStatus(dueAt: Date, now = new Date()) {
  return now > dueAt ? SubscriptionInvoiceStatus.OVERDUE : SubscriptionInvoiceStatus.OPEN;
}

function invoiceNumber(now = new Date()) {
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `EJM-SUB-${month}-${nanoid(8).toUpperCase()}`;
}

function selectedContractPrice(contract: { billingCycle: BillingCycle; monthlyPrice: Prisma.Decimal | null; yearlyPrice: Prisma.Decimal | null }) {
  return contract.billingCycle === BillingCycle.YEARLY ? contract.yearlyPrice : contract.monthlyPrice;
}

function contractDueAt(contract: { subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null; renewalAt: Date | null }) {
  return contract.subscriptionStatus === SubscriptionStatus.TRIAL
    ? contract.trialEndsAt ?? contract.renewalAt
    : contract.renewalAt;
}

export async function ensureSubscriptionRenewalInvoice(input: {
  shopId: string;
  createdById?: string | null;
  now?: Date;
  force?: boolean;
}) {
  const now = input.now ?? new Date();
  const contract = await platformDb.shopSubscriptionContract.findUnique({ where: { shopId: input.shopId } });
  if (!contract || contract.subscriptionStatus === SubscriptionStatus.CANCELLED) return null;

  const parsed = parseSubscriptionPlanSnapshot(contract.termsSnapshot);
  if (!parsed.success || !parsed.data.isConfigured) return null;
  const amount = selectedContractPrice(contract);
  if (amount === null || Number(amount) <= 0) return null;

  const dueAt = contractDueAt(contract) ?? (input.force ? now : null);
  if (!dueAt) return null;
  if (!input.force && dueAt.getTime() - now.getTime() > INVOICE_LEAD_DAYS * 86_400_000) return null;

  const periodStart = dueAt;
  const periodEnd = addBillingPeriod(periodStart, contract.billingCycle);
  const status = subscriptionInvoiceStatus(dueAt, now);
  const nextReminderAt = dueAt > now ? addDays(dueAt, -7) : now;

  return platformDb.subscriptionInvoice.upsert({
    where: { shopId_periodStart_periodEnd: { shopId: input.shopId, periodStart, periodEnd } },
    create: {
      shopId: input.shopId,
      contractId: contract.id,
      invoiceNumber: invoiceNumber(now),
      currency: parsed.data.currency,
      amount,
      billingCycle: contract.billingCycle,
      periodStart,
      periodEnd,
      dueAt,
      status,
      planVersion: contract.planVersion,
      planName: parsed.data.name,
      description: `${parsed.data.name} ${contract.billingCycle.toLowerCase()} subscription renewal`,
      termsSnapshot: parsed.data as Prisma.InputJsonObject,
      nextReminderAt,
      createdById: input.createdById ?? null,
    },
    update: {
      status: { set: status },
      nextReminderAt: { set: nextReminderAt },
    },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

export async function listSubscriptionInvoicesForShop(shopId: string) {
  return platformDb.subscriptionInvoice.findMany({
    where: { shopId },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: [{ status: "asc" }, { dueAt: "desc" }],
    take: 50,
  });
}

export async function refreshSubscriptionInvoiceStatuses(now = new Date()) {
  return platformDb.subscriptionInvoice.updateMany({
    where: { status: SubscriptionInvoiceStatus.OPEN, dueAt: { lt: now } },
    data: { status: SubscriptionInvoiceStatus.OVERDUE, nextReminderAt: now },
  });
}

export async function createSubscriptionPaymentCheckout(input: {
  shopId: string;
  invoiceId: string;
  userId: string;
  email: string;
  callbackUrl: string;
}) {
  const invoice = await platformDb.subscriptionInvoice.findFirst({
    where: { id: input.invoiceId, shopId: input.shopId },
  });
  if (!invoice) throw new SubscriptionBillingError("invoice-missing", "That subscription invoice no longer exists.");
  if (invoice.status === SubscriptionInvoiceStatus.PAID) throw new SubscriptionBillingError("invoice-paid", "That subscription invoice is already paid.");
  if (invoice.status === SubscriptionInvoiceStatus.VOID) throw new SubscriptionBillingError("invoice-void", "That subscription invoice has been voided.");
  if (Number(invoice.amount) <= 0) throw new SubscriptionBillingError("invoice-zero", "This invoice does not require an online payment.");

  const recent = await platformDb.subscriptionPaymentAttempt.findFirst({
    where: {
      invoiceId: invoice.id,
      shopId: input.shopId,
      status: PaymentStatus.PENDING,
      authorizationUrl: { not: null },
      createdAt: { gte: new Date(Date.now() - PENDING_CHECKOUT_MINUTES * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent?.authorizationUrl) return recent;

  const reference = `EJM-SUB-${invoice.invoiceNumber}-${nanoid(7).toUpperCase()}`;
  const attempt = await platformDb.subscriptionPaymentAttempt.create({
    data: {
      invoiceId: invoice.id,
      shopId: input.shopId,
      reference,
      amount: invoice.amount,
      currency: invoice.currency,
      createdById: input.userId,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        contractId: invoice.contractId,
        planVersion: invoice.planVersion,
        billingCycle: invoice.billingCycle,
      },
    },
  });

  try {
    const initialized = await initializePlatformPaystackTransaction({
      email: input.email,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      reference,
      callbackUrl: input.callbackUrl,
      purchaseType: "subscription_invoice",
      metadata: {
        subscription_invoice_id: invoice.id,
        subscription_payment_attempt_id: attempt.id,
        shop_id: input.shopId,
        invoice_number: invoice.invoiceNumber,
      },
    });
    if (!initialized.providerEnabled || !initialized.authorizationUrl) {
      throw new SubscriptionBillingError("paystack-unavailable", "Paystack is not configured for subscription collection.");
    }
    return platformDb.subscriptionPaymentAttempt.update({
      where: { id: attempt.id },
      data: { authorizationUrl: initialized.authorizationUrl },
    });
  } catch (error) {
    await platformDb.subscriptionPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        gatewayResponse: error instanceof Error ? error.message.slice(0, 500) : "Paystack initialization failed.",
      },
    });
    if (error instanceof SubscriptionBillingError) throw error;
    throw new SubscriptionBillingError("checkout-failed", "Subscription checkout could not be started.");
  }
}

async function ownerContact(shopId: string) {
  const [shop, owner] = await Promise.all([
    platformDb.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, credentialContactName: true, credentialEmail: true, credentialPhone: true },
    }),
    platformDb.user.findFirst({
      where: { shopId, role: "OWNER", isActive: true },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!shop) return null;
  return {
    shop,
    name: shop.credentialContactName ?? owner?.name ?? shop.name,
    email: shop.credentialEmail ?? owner?.email ?? null,
    phone: shop.credentialPhone ?? owner?.phone ?? null,
  };
}

function money(amount: Prisma.Decimal | number | string, currencyCode: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currencyCode }).format(Number(amount));
}

function appOrigin() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function sendPaymentReceipt(invoiceId: string) {
  const invoice = await platformDb.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;
  const contact = await ownerContact(invoice.shopId);
  if (!contact) return;
  const amount = money(invoice.amount, invoice.currency);
  const subscriptionUrl = `${appOrigin()}/dashboard/subscription`;
  const pdfUrl = `${appOrigin()}/api/subscription-invoices/${invoice.id}/pdf`;
  const subject = `Payment received for ${invoice.invoiceNumber}`;
  const text = `${contact.shop.name}: we received ${amount} for invoice ${invoice.invoiceNumber}. Your subscription now renews on ${invoice.periodEnd.toLocaleDateString("en-GB")}. Invoice PDF: ${pdfUrl}`;
  const deliveries: Promise<unknown>[] = [];
  if (contact.email && isEmailDeliveryConfigured()) {
    deliveries.push(sendTransactionalEmail({
      to: contact.email,
      recipientName: contact.name,
      subject,
      text,
      html: `<p>Hello ${contact.name},</p><p>We received <strong>${amount}</strong> for subscription invoice <strong>${invoice.invoiceNumber}</strong>.</p><p>Your next renewal date is <strong>${invoice.periodEnd.toLocaleDateString("en-GB")}</strong>.</p><p><a href="${pdfUrl}">Download invoice PDF</a> · <a href="${subscriptionUrl}">Open subscription centre</a></p>`,
      idempotencyKey: `subscription-receipt:${invoice.id}`,
      tags: { category: "subscription-receipt", invoice: invoice.invoiceNumber },
    }));
  }
  if (contact.phone) {
    deliveries.push(sendDirectMessage({
      channel: NotificationChannel.SMS,
      recipientName: contact.name,
      recipientPhone: contact.phone,
      subject,
      body: text,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, billingMessage: true },
    }));
  }
  await Promise.allSettled(deliveries);
}

export async function settleSubscriptionInvoicePayment(data: PaystackTransactionData) {
  const reference = data.reference;
  if (!reference) return { status: "ignored" as const, reason: "missing-reference" };

  const result = await platformDb.$transaction(async (tx) => {
    const attempt = await tx.subscriptionPaymentAttempt.findUnique({
      where: { reference },
      include: { invoice: true },
    });
    if (!attempt) return { status: "ignored" as const, reason: "subscription-payment-not-found" };
    if (attempt.status === PaymentStatus.SUCCESS && attempt.invoice.status === SubscriptionInvoiceStatus.PAID) {
      return { status: "processed" as const, reason: "already-verified", invoiceId: attempt.invoiceId };
    }

    const fail = async (reason: string, message: string) => {
      await tx.subscriptionPaymentAttempt.updateMany({
        where: { id: attempt.id, status: { not: PaymentStatus.SUCCESS } },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          gatewayResponse: message.slice(0, 500),
          providerChannel: data.channel,
          providerTransactionId: data.id === undefined ? null : String(data.id),
        },
      });
      return { status: "failed" as const, reason, invoiceId: attempt.invoiceId };
    };

    if (attempt.invoice.status === SubscriptionInvoiceStatus.PAID) {
    return fail(
      "invoice-already-paid",
      "Payment arrived after this invoice was already settled. Refund or manual reconciliation is required.",
    );
  }

  if (attempt.invoice.status === SubscriptionInvoiceStatus.VOID) return fail("invoice-void", "Payment arrived for a voided subscription invoice and requires manual reconciliation.");
    if (data.status !== "success") return fail(data.status ?? "not-success", data.gateway_response ?? data.status ?? "Payment not successful");
    if (typeof data.amount !== "number") return fail("missing-amount", "Verified provider response did not include an amount.");
    const expectedAmount = amountToSubunit(Number(attempt.amount));
    if (data.amount !== expectedAmount) return fail("amount-mismatch", `Amount mismatch: expected ${expectedAmount}, got ${data.amount}`);
    if (!data.currency) return fail("missing-currency", "Verified provider response did not include a currency.");
    if (data.currency.toUpperCase() !== attempt.currency.toUpperCase()) return fail("currency-mismatch", `Currency mismatch: expected ${attempt.currency}, got ${data.currency}`);

    await tx.subscriptionPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentStatus.SUCCESS,
        verifiedAt: new Date(),
        failedAt: null,
        gatewayResponse: data.gateway_response ?? "Successful",
        providerChannel: data.channel,
        providerTransactionId: data.id === undefined ? null : String(data.id),
      },
    });
    await tx.subscriptionInvoice.update({
      where: { id: attempt.invoiceId },
      data: { status: SubscriptionInvoiceStatus.PAID, paidAt: new Date(), nextReminderAt: null },
    });
    await tx.shopSubscriptionContract.updateMany({
      where: { id: attempt.invoice.contractId, shopId: attempt.shopId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        renewalAt: attempt.invoice.periodEnd,
        graceEndsAt: null,
      },
    });
    await tx.shop.update({
      where: { id: attempt.shopId },
      data: { subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionRenewalAt: attempt.invoice.periodEnd },
    });
    await tx.auditLog.create({
      data: {
        shopId: attempt.shopId,
        action: "subscription.payment_verified",
        entityType: "SubscriptionInvoice",
        entityId: attempt.invoiceId,
        metadata: {
          invoiceNumber: attempt.invoice.invoiceNumber,
          reference,
          amount: attempt.amount.toString(),
          currency: attempt.currency,
          renewalAt: attempt.invoice.periodEnd.toISOString(),
          providerChannel: data.channel ?? null,
        },
      },
    });
    return { status: "processed" as const, reason: "verified", invoiceId: attempt.invoiceId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });

  if (result.status === "processed" && result.reason === "verified") {
    await sendPaymentReceipt(result.invoiceId).catch(() => undefined);
  }
  return result;
}

export async function reconcileSubscriptionPaymentAttempt(attemptId: string) {
  const attempt = await platformDb.subscriptionPaymentAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new SubscriptionBillingError("attempt-missing", "That payment attempt no longer exists.");
  const verified = await verifyPaystackTransaction(attempt.reference);
  if (!verified) throw new SubscriptionBillingError("verification-unavailable", "Paystack did not return a verifiable transaction for that reference.");
  return settleSubscriptionInvoicePayment(verified);
}

export async function markSubscriptionInvoicePaidManually(input: {
  invoiceId: string;
  adminId: string;
  reason: string;
}) {
  const reference = `MANUAL-SUB-${nanoid(12).toUpperCase()}`;
  const result = await platformDb.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw new SubscriptionBillingError("invoice-missing", "That subscription invoice no longer exists.");
    if (invoice.status === SubscriptionInvoiceStatus.VOID) throw new SubscriptionBillingError("invoice-void", "A void invoice cannot be marked paid.");
    if (invoice.status === SubscriptionInvoiceStatus.PAID) return invoice;

    await tx.subscriptionPaymentAttempt.updateMany({
    where: { invoiceId: invoice.id, status: PaymentStatus.PENDING },
    data: {
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      gatewayResponse: "Invoice settled manually. Any later provider debit requires refund or reconciliation.",
    },
  });

  await tx.subscriptionPaymentAttempt.create({
      data: {
        invoiceId: invoice.id,
        shopId: invoice.shopId,
        provider: "manual",
        reference,
        amount: invoice.amount,
        currency: invoice.currency,
        status: PaymentStatus.SUCCESS,
        verifiedAt: new Date(),
        gatewayResponse: input.reason,
        createdById: input.adminId,
        metadata: { manualOverride: true, reason: input.reason },
      },
    });
    const paid = await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { status: SubscriptionInvoiceStatus.PAID, paidAt: new Date(), nextReminderAt: null },
    });
    await tx.shopSubscriptionContract.updateMany({
      where: { id: invoice.contractId, shopId: invoice.shopId },
      data: { subscriptionStatus: SubscriptionStatus.ACTIVE, trialEndsAt: null, renewalAt: invoice.periodEnd, graceEndsAt: null },
    });
    await tx.shop.update({
      where: { id: invoice.shopId },
      data: { subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionRenewalAt: invoice.periodEnd },
    });
    await tx.auditLog.create({
      data: {
        shopId: invoice.shopId,
        userId: input.adminId,
        action: "admin.subscription_invoice_marked_paid",
        entityType: "SubscriptionInvoice",
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, reference, reason: input.reason },
      },
    });
    return paid;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await sendPaymentReceipt(result.id).catch(() => undefined);
  return result;
}

export async function voidSubscriptionInvoice(input: { invoiceId: string; adminId: string; reason: string }) {
  return platformDb.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw new SubscriptionBillingError("invoice-missing", "That subscription invoice no longer exists.");
    if (invoice.status === SubscriptionInvoiceStatus.PAID) throw new SubscriptionBillingError("invoice-paid", "A paid invoice cannot be voided.");
    const voided = await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { status: SubscriptionInvoiceStatus.VOID, voidedAt: new Date(), voidReason: input.reason, nextReminderAt: null },
    });
    await tx.subscriptionPaymentAttempt.updateMany({
      where: { invoiceId: invoice.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED, failedAt: new Date(), gatewayResponse: `Invoice voided: ${input.reason}` },
    });
    await tx.auditLog.create({
      data: {
        shopId: invoice.shopId,
        userId: input.adminId,
        action: "admin.subscription_invoice_voided",
        entityType: "SubscriptionInvoice",
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, reason: input.reason },
      },
    });
    return voided;
  });
}

export async function sendSubscriptionInvoiceReminder(input: {
  invoiceId: string;
  initiatedById?: string | null;
  force?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const invoice = await platformDb.subscriptionInvoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice || invoice.status === SubscriptionInvoiceStatus.PAID || invoice.status === SubscriptionInvoiceStatus.VOID) return { sent: false, reason: "closed" };
  if (!input.force && invoice.nextReminderAt && invoice.nextReminderAt > now) return { sent: false, reason: "not-due" };

  const contact = await ownerContact(invoice.shopId);
  if (!contact || (!contact.email && !contact.phone)) return { sent: false, reason: "missing-contact" };
  const amount = money(invoice.amount, invoice.currency);
  const due = invoice.dueAt.toLocaleDateString("en-GB");
  const subscriptionUrl = `${appOrigin()}/dashboard/subscription`;
  const subject = `${invoice.status === SubscriptionInvoiceStatus.OVERDUE ? "Overdue" : "Upcoming"} subscription invoice ${invoice.invoiceNumber}`;
  const text = `${contact.shop.name}: ${amount} for invoice ${invoice.invoiceNumber} is due ${due}. Renew securely: ${subscriptionUrl}`;
  const deliveries: Promise<unknown>[] = [];
  if (contact.email && isEmailDeliveryConfigured()) {
    deliveries.push(sendTransactionalEmail({
      to: contact.email,
      recipientName: contact.name,
      subject,
      text,
      html: `<p>Hello ${contact.name},</p><p>Subscription invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> is due <strong>${due}</strong>.</p><p><a href="${subscriptionUrl}">Open the subscription centre and pay securely</a>.</p>`,
      idempotencyKey: `subscription-reminder:${invoice.id}:${invoice.reminderCount + 1}`,
      tags: { category: "subscription-reminder", invoice: invoice.invoiceNumber },
    }));
  }
  if (contact.phone) {
    deliveries.push(sendDirectMessage({
      channel: NotificationChannel.SMS,
      recipientName: contact.name,
      recipientPhone: contact.phone,
      subject,
      body: text,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, billingMessage: true },
    }));
  }
  const settled = await Promise.allSettled(deliveries);
  const attempted = settled.length > 0;
  await platformDb.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: {
      reminderCount: { increment: attempted ? 1 : 0 },
      lastReminderAt: attempted ? now : invoice.lastReminderAt,
      nextReminderAt: attempted ? addDays(now, invoice.status === SubscriptionInvoiceStatus.OVERDUE ? 3 : 7) : addDays(now, 1),
    },
  });
  if (attempted) {
    await platformDb.auditLog.create({
      data: {
        shopId: invoice.shopId,
        userId: input.initiatedById ?? null,
        action: input.initiatedById ? "admin.subscription_invoice_reminder_sent" : "system.subscription_invoice_reminder_sent",
        entityType: "SubscriptionInvoice",
        entityId: invoice.id,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          reminderNumber: invoice.reminderCount + 1,
          emailAttempted: Boolean(contact.email && isEmailDeliveryConfigured()),
          smsAttempted: Boolean(contact.phone),
        },
      },
    });
  }
  return { sent: attempted, reason: attempted ? "attempted" : "not-configured" };
}

export async function processSubscriptionInvoices(now = new Date()) {
  await refreshSubscriptionInvoiceStatuses(now);
  const contracts = await platformDb.shopSubscriptionContract.findMany({
    where: { subscriptionStatus: { not: SubscriptionStatus.CANCELLED } },
    select: { shopId: true },
  });
  let created = 0;
  for (const contract of contracts) {
    const invoice = await ensureSubscriptionRenewalInvoice({ shopId: contract.shopId, now }).catch(() => null);
    if (invoice) created += 1;
  }

  const reminders = await platformDb.subscriptionInvoice.findMany({
    where: {
      status: { in: [SubscriptionInvoiceStatus.OPEN, SubscriptionInvoiceStatus.OVERDUE] },
      nextReminderAt: { lte: now },
    },
    select: { id: true },
    orderBy: { nextReminderAt: "asc" },
    take: 250,
  });
  let reminded = 0;
  for (const invoice of reminders) {
    const result = await sendSubscriptionInvoiceReminder({ invoiceId: invoice.id, now }).catch(() => ({ sent: false }));
    if (result.sent) reminded += 1;
  }
  return { contracts: contracts.length, created, reminders: reminders.length, reminded };
}
