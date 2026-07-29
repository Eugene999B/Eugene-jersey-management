import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { currency, shortDate, titleCase } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { platformDb } from "@/lib/platform-db";
import { buildTablePdf } from "@/lib/table-export";

export async function GET(_request: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireSession();
  if (session.role === Role.SUPER_ADMIN) await requirePlatformPermission("billing");
  const { invoiceId } = await context.params;
  const invoice = await platformDb.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" } } },
  });
  if (!invoice || (session.role !== Role.SUPER_ADMIN && invoice.shopId !== session.shopId)) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const shop = await platformDb.shop.findUnique({ where: { id: invoice.shopId }, select: { name: true } });
  const pdf = buildTablePdf({
    title: `Eugene Jersey Management Subscription Invoice ${invoice.invoiceNumber}`,
    subtitle: `${shop?.name ?? "Shop"} · ${invoice.planName} plan · version ${invoice.planVersion}`,
    metrics: [
      { label: "Status", value: titleCase(invoice.status) },
      { label: "Amount", value: currency(invoice.amount.toString(), invoice.currency) },
      { label: "Due", value: shortDate(invoice.dueAt) },
      { label: "Billing cycle", value: titleCase(invoice.billingCycle) },
    ],
    columns: ["Description", "Period start", "Period end", "Amount"],
    rows: [[
      invoice.description,
      shortDate(invoice.periodStart),
      shortDate(invoice.periodEnd),
      currency(invoice.amount.toString(), invoice.currency),
    ], ...invoice.paymentAttempts.map((attempt) => [
      `Payment attempt ${attempt.reference} · ${titleCase(attempt.status)}`,
      shortDate(attempt.createdAt),
      attempt.verifiedAt ? shortDate(attempt.verifiedAt) : "Not verified",
      currency(attempt.amount.toString(), attempt.currency),
    ])],
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
