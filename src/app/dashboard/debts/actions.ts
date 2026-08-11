"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DebtStatus, InstallmentStatus, NotificationChannel, PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendCustomerMessage } from "@/lib/messaging";
import { claimDebtPaymentSubmission, completeDebtPaymentSubmission } from "@/lib/debt-payment-idempotency";

const debtSchema = z.object({
  customerId: z.string().min(1),
  principalAmount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
  installments: z.coerce.number().int().min(1).max(12).default(1),
});

function installmentDates(firstDueDate: Date, count: number) {
  return Array.from({ length: count }).map((_, index) => {
    const dueDate = new Date(firstDueDate);
    dueDate.setMonth(dueDate.getMonth() + index);
    return dueDate;
  });
}

export async function createDebtAction(formData: FormData) {
  const session = await requireRole(permissions.debts);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = debtSchema.safeParse({
    customerId: formData.get("customerId"),
    principalAmount: formData.get("principalAmount"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") || undefined,
    installments: formData.get("installments") || 1,
  });

  if (!parsed.success) redirect("/dashboard/debts?error=invalid");

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, shopId: session.shopId },
  });
  if (!customer) redirect("/dashboard/debts?error=customer");

  const installmentAmount = Number((parsed.data.principalAmount / parsed.data.installments).toFixed(2));
  const debt = await prisma.debt.create({
    data: {
      shopId: session.shopId,
      customerId: customer.id,
      principalAmount: parsed.data.principalAmount,
      dueDate: parsed.data.dueDate,
      notes: parsed.data.notes,
      installments: {
        create: installmentDates(parsed.data.dueDate, parsed.data.installments).map((dueDate, index) => ({
          amount: index === parsed.data.installments - 1
            ? Number((parsed.data.principalAmount - installmentAmount * (parsed.data.installments - 1)).toFixed(2))
            : installmentAmount,
          dueDate,
        })),
      },
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "debt.created",
    entityType: "Debt",
    entityId: debt.id,
    metadata: { customerId: customer.id, principalAmount: parsed.data.principalAmount },
  });

  revalidatePath("/dashboard/debts");
}

const paymentSchema = z.object({
  debtId: z.string().min(1),
  collectionKey: z.string().min(12).max(100),
  amount: z.coerce.number().positive(),
  method: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOMO]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
}).superRefine((value, context) => {
  if (value.method !== PaymentMethod.CASH && !value.reference) {
    context.addIssue({ code: "custom", path: ["reference"], message: "Card and mobile-money collections require a reference." });
  }
});

type DebtPaymentResult = { debtId: string; paidAmount: number; duplicate: boolean };

export async function recordDebtPaymentAction(formData: FormData) {
  const session = await requireRole(permissions.debts);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = paymentSchema.safeParse({
    debtId: formData.get("debtId"),
    collectionKey: formData.get("collectionKey"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/debts?error=payment");

  let paymentResult: DebtPaymentResult;
  try {
    paymentResult = await prisma.$transaction(async (tx) => {
      const claim = await claimDebtPaymentSubmission(tx, {
        key: parsed.data.collectionKey,
        shopId,
        debtId: parsed.data.debtId,
      });
      if (claim.duplicate) {
        const existingPayment = await tx.debtPayment.findFirst({
          where: { id: claim.paymentId, shopId, debtId: parsed.data.debtId },
          select: { debt: { select: { paidAmount: true } } },
        });
        if (!existingPayment) throw new Error("COLLECTION_KEY_CONFLICT");
        return { debtId: parsed.data.debtId, paidAmount: Number(existingPayment.debt.paidAmount), duplicate: true };
      }

      const debt = await tx.debt.findFirstOrThrow({
        where: { id: parsed.data.debtId, shopId },
      });
      const installments = await tx.debtInstallment.findMany({ where: { debtId: debt.id }, orderBy: { dueDate: "asc" } });
      const balance = Number(debt.principalAmount) - Number(debt.paidAmount);
      if (balance <= 0 || parsed.data.amount > balance) throw new Error("AMOUNT_EXCEEDS_BALANCE");

      if (parsed.data.method !== PaymentMethod.CASH && parsed.data.reference) {
        const reusedReference = await tx.debtPayment.findFirst({
          where: {
            shopId,
            method: parsed.data.method,
            reference: { equals: parsed.data.reference, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (reusedReference) throw new Error("COLLECTION_REFERENCE_REUSED");
      }

      const paidAmount = Number((Number(debt.paidAmount) + parsed.data.amount).toFixed(2));
      const fullyPaid = paidAmount >= Number(debt.principalAmount);
      const updated = await tx.debt.updateMany({
        where: { id: debt.id, paidAmount: debt.paidAmount },
        data: { paidAmount, status: fullyPaid ? DebtStatus.PAID : DebtStatus.PARTIAL },
      });
      if (updated.count !== 1) throw new Error("DEBT_CHANGED");

      const payment = await tx.debtPayment.create({
        data: {
          shopId,
          debtId: debt.id,
          receivedById: session.id,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
        },
      });
      await completeDebtPaymentSubmission(tx, {
        key: parsed.data.collectionKey,
        shopId,
        debtId: debt.id,
        paymentId: payment.id,
      });

      let remaining = paidAmount;
      for (const installment of installments) {
        const installmentPaid = remaining >= Number(installment.amount);
        remaining = Math.max(0, remaining - Number(installment.amount));
        await tx.debtInstallment.update({
          where: { id: installment.id },
          data: {
            status: installmentPaid ? InstallmentStatus.PAID : installment.dueDate < new Date() ? InstallmentStatus.LATE : InstallmentStatus.SCHEDULED,
            paidAt: installmentPaid ? installment.paidAt ?? new Date() : null,
          },
        });
      }
      return { debtId: debt.id, paidAmount, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "AMOUNT_EXCEEDS_BALANCE") {
      redirect("/dashboard/debts?error=amount-exceeds-balance");
    }
    if (error instanceof Error && error.message === "COLLECTION_REFERENCE_REUSED") {
      redirect("/dashboard/debts?error=reference-reused");
    }
    if (error instanceof Error && ["DEBT_CHANGED", "COLLECTION_STILL_PROCESSING"].includes(error.message)) {
      redirect("/dashboard/debts?error=collection-changed");
    }
    if (error instanceof Error && error.message === "COLLECTION_KEY_CONFLICT") {
      redirect("/dashboard/debts?error=collection-conflict");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      redirect("/dashboard/debts?error=collection-changed");
    }
    throw error;
  }

  if (!paymentResult.duplicate) {
    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: "debt.payment_recorded",
      entityType: "Debt",
      entityId: paymentResult.debtId,
      metadata: { amount: parsed.data.amount, method: parsed.data.method, reference: parsed.data.reference },
    });
  }

  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/closing");
}

const reminderSchema = z.object({
  debtId: z.string().min(1),
  channel: z.nativeEnum(NotificationChannel),
});

export async function sendDebtReminderAction(formData: FormData) {
  const session = await requireRole(permissions.debts);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = reminderSchema.safeParse({
    debtId: formData.get("debtId"),
    channel: formData.get("channel"),
  });
  if (!parsed.success) redirect("/dashboard/debts?error=reminder");

  const debt = await prisma.debt.findFirstOrThrow({
    where: { id: parsed.data.debtId, shopId: session.shopId },
    include: { customer: true, shop: true },
  });

  const balance = Number(debt.principalAmount) - Number(debt.paidAmount);
  const message = await sendCustomerMessage({
    shopId: session.shopId,
    customerId: debt.customerId,
    channel: parsed.data.channel,
    recipientName: debt.customer.name,
    recipientPhone: debt.customer.phone,
    recipientEmail: debt.customer.email,
    subject: "Debt payment reminder",
    body: `${debt.shop.name}: your outstanding balance is ${balance.toFixed(2)} ${debt.shop.currency}. Due date: ${debt.dueDate.toDateString()}.`,
    metadata: { debtId: debt.id, balance, sentBy: session.id },
  });

  if (message.providerReference === "INSUFFICIENT-CREDITS") {
    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: "debt.reminder_blocked_no_credits",
      entityType: "Debt",
      entityId: debt.id,
      metadata: { channel: parsed.data.channel },
    });
    revalidatePath("/dashboard/messages");
    redirect(`/dashboard/debts?error=${parsed.data.channel === NotificationChannel.SMS ? "sms-credits" : "whatsapp-credits"}`);
  }

  await prisma.debt.update({
    where: { id: debt.id },
    data: {
      reminderCount: { increment: 1 },
      lastReminderAt: new Date(),
      status: debt.dueDate < new Date() ? DebtStatus.OVERDUE : debt.status,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "debt.reminder_sent",
    entityType: "Debt",
    entityId: debt.id,
    metadata: { channel: parsed.data.channel, status: message.status },
  });

  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/messages");
}
