import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { buildCsvReport, buildSimplePdf, buildWordHtmlReport, type ExportSummary } from "@/lib/report-export";

function rangeStart(range = "30") {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Number(range));
  return date;
}

export async function GET(request: NextRequest) {
  const session = await requireRole(permissions.reports);
  if (!session.shopId) return NextResponse.json({ error: "Missing shop context." }, { status: 403 });

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const range = request.nextUrl.searchParams.get("range") ?? "30";
  const start = rangeStart(range);

  const [shop, orders, variants, debts] = await Promise.all([
    prisma.shop.findUniqueOrThrow({ where: { id: session.shopId } }),
    prisma.order.findMany({
      where: { shopId: session.shopId, createdAt: { gte: start }, status: { not: "CANCELLED" } },
      include: { customer: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.productVariant.findMany({
      where: { product: { shopId: session.shopId } },
      include: { product: true },
      orderBy: { stockQty: "asc" },
      take: 80,
    }),
    prisma.debt.findMany({
      where: { shopId: session.shopId, status: { notIn: ["PAID", "WRITTEN_OFF"] } },
    }),
  ]);

  const summary: ExportSummary = {
    shopName: shop.name,
    currencyCode: shop.currency,
    revenue: orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
    debt: debts.reduce((sum, debt) => sum + Number(debt.principalAmount) - Number(debt.paidAmount), 0),
    orders: orders.map((order) => ({
      receiptNumber: order.receiptNumber,
      customerName: order.customer?.name ?? "Walk-in",
      status: order.status,
      paymentStatus: order.payments.some((payment) => payment.status === "SUCCESS") ? "Paid" : "Pending",
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt,
    })),
    lowStock: variants
      .filter((variant) => variant.stockQty <= variant.product.lowStockThreshold)
      .map((variant) => ({ sku: variant.sku, productName: variant.product.name, stockQty: variant.stockQty })),
  };

  if (format === "word") {
    return new NextResponse(buildWordHtmlReport(summary), {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${shop.slug}-report.doc"`,
      },
    });
  }

  if (format === "pdf") {
    return new NextResponse(buildSimplePdf(summary), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${shop.slug}-report.pdf"`,
      },
    });
  }

  const csv = buildCsvReport(summary);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": format === "excel" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${shop.slug}-report.${format === "excel" ? "xls" : "csv"}"`,
    },
  });
}
