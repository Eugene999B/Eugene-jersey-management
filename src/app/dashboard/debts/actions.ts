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
  amount: z.coerce.number().positive(),
  method: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOMO]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function recordDebtPaymentAction(formData: FormData) {
  const session = await requireRole(permissions.debts);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = paymentSchema.safeParse({
    debtId: formData.get("debtId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/debts?error=payment");

  let paymentResult: { debtId: string; paidAmount: number };
  try {
    paymentResult = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirstOrThrow({
        where: { id: parsed.data.debtId, shopId },
      });
      const installments = await tx.debtInstallment.findMany({ where: { debtId: debt.id }, orderBy: { dueDate: "asc" } });
      const balance = Number(debt.principalAmount) - Number(debt.paidAmount);
      if (balance <= 0 || parsed.data.amount > balance) throw new Error("AMOUNT_EXCEEDS_BALANCE");
      const paidAmount = Number((Number(debt.paidAmount) + parsed.data.amount).toFixed(2));
      const fullyPaid = paidAmount >= Number(debt.principalAmount);
      const updated = await tx.debt.updateMany({
        where: { id: debt.id, paidAmount: debt.paidAmount },
        data: { paidAmount, status: fullyPaid ? DebtStatus.PAID : DebtStatus.PARTIAL },
      });
      if (updated.count !== 1) throw new Error("DEBT_CHANGED");

      await tx.debtPayment.create({
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
      return { debtId: debt.id, paidAmount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && (error.message === "AMOUNT_EXCEEDS_BALANCE" || error.message === "DEBT_CHANGED")) {
      redirect("/dashboard/debts?error=amount-exceeds-balance");
    }
    throw error;
  }

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "debt.payment_recorded",
    entityType: "Debt",
    entityId: paymentResult.debtId,
    metadata: { amount: parsed.data.amount, method: parsed.data.method, reference: parsed.data.reference },
  });

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
  await sendCustomerMessage({
    shopId: session.shopId,
    customerId: debt.customerId,
    channel: parsed.data.channel,
    recipientName: debt.customer.name,
    recipientPhone: debt.customer.phone,
    recipientEmail: debt.customer.email,
    subject: "Debt payment reminder",
    body: `${debt.shop.name}: your outstanding balance is ${balance.toFixed(2)} ${debt.shop.currency}. Due date: ${debt.dueDate.toDateString()}.`,
    metadata: { debtId: debt.id, balance },
  });

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
    metadata: { channel: parsed.data.channel },
  });

  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/messages");
}
