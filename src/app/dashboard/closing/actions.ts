"use server";

import { ClosingStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { financialPeriodTotals } from "@/lib/financial-period";
import { permissions } from "@/lib/rbac";

const closingSchema = z.object({
  businessDate: z.coerce.date(),
  openingFloat: z.coerce.number().min(0).max(100_000_000).default(0),
  manualCash: z.coerce.number().min(0).max(100_000_000),
  expenses: z.coerce.number().min(0).max(100_000_000).default(0),
  refunds: z.coerce.number().min(0).max(100_000_000).default(0),
  notes: z.string().trim().max(1000).optional(),
  existingClosingId: z.string().trim().min(1).max(100).optional(),
  expectedUpdatedAt: z.coerce.date().optional(),
});

function dateBounds(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function hasPrismaCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
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
    existingClosingId: formData.get("existingClosingId") || undefined,
    expectedUpdatedAt: formData.get("expectedUpdatedAt") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/closing?error=invalid");

  const dateKey = parsed.data.businessDate.toISOString().slice(0, 10);
  const revising = Boolean(parsed.data.existingClosingId);
  if (revising !== Boolean(parsed.data.expectedUpdatedAt)) {
    redirect(`/dashboard/closing?date=${dateKey}&error=closing-changed`);
  }

  const { start, end } = dateBounds(parsed.data.businessDate);
  const truth = await financialPeriodTotals(session.shopId, start, end);
  const expectedCash = truth.netTenders.CASH + truth.debtCollections.CASH;
  const expectedCard = truth.netTenders.CARD + truth.debtCollections.CARD;
  const expectedMomo = truth.netTenders.MOMO + truth.debtCollections.MOMO;
  const expectedCashWithFloat = expectedCash + parsed.data.openingFloat - parsed.data.expenses - parsed.data.refunds;
  const cashDifference = Number((parsed.data.manualCash - expectedCashWithFloat).toFixed(2));
  const status = Math.abs(cashDifference) <= 1 ? ClosingStatus.BALANCED : ClosingStatus.VARIANCE;
  const data = {
    openingFloat: parsed.data.openingFloat,
    expectedCash,
    manualCash: parsed.data.manualCash,
    cashDifference,
    expectedCard,
    expectedMomo,
    creditSales: truth.creditSales,
    totalSales: truth.bookedSales,
    expenses: parsed.data.expenses,
    refunds: parsed.data.refunds,
    debtCollections: truth.debtCollections.total,
    debtCash: truth.debtCollections.CASH,
    debtCard: truth.debtCollections.CARD,
    debtMomo: truth.debtCollections.MOMO,
    orderCount: truth.bookedOrderCount,
    status,
    notes: parsed.data.notes,
  };

  let closing: { id: string };
  if (revising) {
    try {
      closing = await prisma.dailyClosing.update({
        where: {
          id: parsed.data.existingClosingId!,
          shopId: session.shopId,
          businessDate: parsed.data.businessDate,
          updatedAt: parsed.data.expectedUpdatedAt!,
        },
        data,
        select: { id: true },
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        redirect(`/dashboard/closing?date=${dateKey}&error=closing-changed`);
      }
      throw error;
    }
  } else {
    try {
      closing = await prisma.dailyClosing.create({
        data: {
          shopId: session.shopId,
          businessDate: parsed.data.businessDate,
          closedById: session.id,
          ...data,
        },
        select: { id: true },
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        redirect(`/dashboard/closing?date=${dateKey}&error=closing-exists`);
      }
      throw error;
    }
  }

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: revising ? "closing.day_revised" : "closing.day_closed",
    entityType: "DailyClosing",
    entityId: closing.id,
    metadata: {
      businessDate: parsed.data.businessDate.toISOString(),
      cashDifference,
      recognizedOrders: truth.bookedOrderCount,
      providerRefunds: truth.providerRefunds,
      captures: truth.captures,
      previousUpdatedAt: parsed.data.expectedUpdatedAt?.toISOString() ?? null,
    },
  });
  revalidatePath("/dashboard/closing");
  redirect(`/dashboard/closing?date=${dateKey}`);
}
