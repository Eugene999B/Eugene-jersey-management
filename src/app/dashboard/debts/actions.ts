"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DebtStatus, InstallmentStatus, NotificationChannel } from "@prisma/client";
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
  if (!session.shopId) redirect("/login");

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
});

export async function recordDebtPaymentAction(formData: FormData) {
  const session = await requireRole(permissions.debts);
  if (!session.shopId) redirect("/login");

  const parsed = paymentSchema.safeParse({
    debtId: formData.get("debtId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) redirect("/dashboard/debts?error=payment");

  const debt = await prisma.debt.findFirstOrThrow({
    where: { id: parsed.data.debtId, shopId: session.shopId },
    include: { installments: { orderBy: { dueDate: "asc" } } },
  });

  const paidAmount = Number(debt.paidAmount) + parsed.data.amount;
  const fullyPaid = paidAmount >= Number(debt.principalAmount);

  await prisma.$transaction(async (tx) => {
    await tx.debt.update({
      where: { id: debt.id },
      data: {
        paidAmount,
        status: fullyPaid ? DebtStatus.PAID : DebtStatus.PARTIAL,
      },
    });

    let remaining = parsed.data.amount;
    for (const installment of debt.installments) {
      if (remaining <= 0 || installment.status === InstallmentStatus.PAID) continue;
      remaining -= Number(installment.amount);
      await tx.debtInstallment.update({
        where: { id: installment.id },
        data: {
          status: remaining >= 0 ? InstallmentStatus.PAID : installment.status,
          paidAt: remaining >= 0 ? new Date() : null,
        },
      });
    }
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "debt.payment_recorded",
    entityType: "Debt",
    entityId: debt.id,
    metadata: { amount: parsed.data.amount },
  });

  revalidatePath("/dashboard/debts");
}

const reminderSchema = z.object({
  debtId: z.string().min(1),
  channel: z.nativeEnum(NotificationChannel),
});

export async function sendDebtReminderAction(formData: FormData) {
  const session = await requireRole(permissions.debts);
  if (!session.shopId) redirect("/login");

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
