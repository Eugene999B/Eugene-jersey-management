"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClosingStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const closingSchema = z.object({
  businessDate: z.coerce.date(),
  openingFloat: z.coerce.number().min(0).default(0),
  manualCash: z.coerce.number().min(0),
  expenses: z.coerce.number().min(0).default(0),
  refunds: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

function dateBounds(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function expectedTotals(shopId: string, businessDate: Date) {
  const { start, end } = dateBounds(businessDate);
  const [orders, debtPayments] = await Promise.all([
    prisma.order.findMany({
      where: { shopId, createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: { payments: true },
    }),
    prisma.debtPayment.findMany({
      where: { shopId, receivedAt: { gte: start, lt: end } },
    }),
  ]);

  const totals = {
    expectedCash: 0,
    expectedCard: 0,
    expectedMomo: 0,
    creditSales: 0,
    totalSales: 0,
    orderCount: orders.length,
    debtCollections: 0,
    debtCash: 0,
    debtCard: 0,
    debtMomo: 0,
  };

  orders.forEach((order) => {
    totals.totalSales += Number(order.totalAmount);
    order.payments.forEach((payment) => {
      if (payment.status !== PaymentStatus.SUCCESS && payment.method !== PaymentMethod.STORE_CREDIT) return;
      if (payment.method === PaymentMethod.CASH) totals.expectedCash += Number(payment.amount);
      if (payment.method === PaymentMethod.CARD) totals.expectedCard += Number(payment.amount);
      if (payment.method === PaymentMethod.MOMO) totals.expectedMomo += Number(payment.amount);
      if (payment.method === PaymentMethod.STORE_CREDIT) totals.creditSales += Number(payment.amount);
    });
  });

  debtPayments.forEach((payment) => {
    const amount = Number(payment.amount);
    totals.debtCollections += amount;
    if (payment.method === PaymentMethod.CASH) totals.debtCash += amount;
    if (payment.method === PaymentMethod.CARD) totals.debtCard += amount;
    if (payment.method === PaymentMethod.MOMO) totals.debtMomo += amount;
  });

  // Debt collections are cash inflows, not new sales. Include them in tender
  // reconciliation while keeping totalSales limited to orders for this day.
  totals.expectedCash += totals.debtCash;
  totals.expectedCard += totals.debtCard;
  totals.expectedMomo += totals.debtMomo;

  return totals;
}

export async function closeDayAction(formData: FormData) {
  const session = await requireRole(permissions.closing);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = closingSchema.safeParse({
    businessDate: formData.get("businessDate"),
    openingFloat: formData.get("openingFloat") || 0,
    manualCash: formData.get("manualCash"),
    expenses: formData.get("expenses") || 0,
    refunds: formData.get("refunds") || 0,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) redirect("/dashboard/closing?error=invalid");

  const expected = await expectedTotals(session.shopId, parsed.data.businessDate);
  const expectedCashWithFloat = expected.expectedCash + parsed.data.openingFloat - parsed.data.expenses - parsed.data.refunds;
  const cashDifference = Number((parsed.data.manualCash - expectedCashWithFloat).toFixed(2));
  const status = Math.abs(cashDifference) <= 1 ? ClosingStatus.BALANCED : ClosingStatus.VARIANCE;

  const closing = await prisma.dailyClosing.upsert({
    where: {
      shopId_businessDate: {
        shopId: session.shopId,
        businessDate: parsed.data.businessDate,
      },
    },
    update: {
      closedById: session.id,
      openingFloat: parsed.data.openingFloat,
      expectedCash: expected.expectedCash,
      manualCash: parsed.data.manualCash,
      cashDifference,
      expectedCard: expected.expectedCard,
      expectedMomo: expected.expectedMomo,
      creditSales: expected.creditSales,
      totalSales: expected.totalSales,
      expenses: parsed.data.expenses,
      refunds: parsed.data.refunds,
      debtCollections: expected.debtCollections,
      debtCash: expected.debtCash,
      debtCard: expected.debtCard,
      debtMomo: expected.debtMomo,
      orderCount: expected.orderCount,
      status,
      notes: parsed.data.notes,
    },
    create: {
      shopId: session.shopId,
      closedById: session.id,
      businessDate: parsed.data.businessDate,
      openingFloat: parsed.data.openingFloat,
      expectedCash: expected.expectedCash,
      manualCash: parsed.data.manualCash,
      cashDifference,
      expectedCard: expected.expectedCard,
      expectedMomo: expected.expectedMomo,
      creditSales: expected.creditSales,
      totalSales: expected.totalSales,
      expenses: parsed.data.expenses,
      refunds: parsed.data.refunds,
      debtCollections: expected.debtCollections,
      debtCash: expected.debtCash,
      debtCard: expected.debtCard,
      debtMomo: expected.debtMomo,
      orderCount: expected.orderCount,
      status,
      notes: parsed.data.notes,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "closing.day_closed",
    entityType: "DailyClosing",
    entityId: closing.id,
    metadata: { businessDate: parsed.data.businessDate.toISOString(), cashDifference },
  });

  revalidatePath("/dashboard/closing");
  redirect(`/dashboard/closing?date=${parsed.data.businessDate.toISOString().slice(0, 10)}`);
}
