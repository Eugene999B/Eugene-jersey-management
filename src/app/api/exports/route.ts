import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole, permissions } from "@/lib/rbac";
import { currency, shortDate, titleCase } from "@/lib/format";
import { buildTableCsv, buildTableDocx, buildTablePdf, buildTableXlsx, type TableExport } from "@/lib/table-export";

type ExportModule = "debts" | "pos" | "payments" | "suppliers" | "closing" | "catalog" | "messages" | "activity" | "network" | "designs";
type ExportFilters = { from: Date | null; to: Date | null; query: string };

function dateRange(filters: ExportFilters) {
  if (!filters.from && !filters.to) return undefined;
  return { gte: filters.from ?? undefined, lte: filters.to ?? undefined };
}

function applySearch(data: TableExport, query: string): TableExport {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return data;
  const rows = data.rows.filter((row) => row.some((cell) => String(cell).toLocaleLowerCase().includes(needle)));
  return { ...data, rows, subtitle: `${data.subtitle ?? ""} Search: “${query.trim()}”. ${rows.length} matching row(s).`.trim() };
}

function canExport(module: ExportModule, role: Parameters<typeof hasRole>[0]) {
  if (hasRole(role, permissions.exports)) return true;
  if (module === "closing" && hasRole(role, permissions.closing)) return true;
  if (module === "debts" && hasRole(role, permissions.debts)) return true;
  if (module === "suppliers" && hasRole(role, permissions.suppliers)) return true;
  if (module === "network" && hasRole(role, permissions.network)) return true;
  if (module === "designs" && hasRole(role, permissions.designs)) return true;
  if (module === "payments" && hasRole(role, permissions.orderFinance)) return true;
  return false;
}

async function exportData(module: ExportModule, shopId: string, filters: ExportFilters): Promise<TableExport> {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  const createdAt = dateRange(filters);

  if (module === "debts") {
    const debts = await prisma.debt.findMany({ where: { shopId, createdAt }, include: { customer: true }, orderBy: { dueDate: "asc" } });
    const openBalance = debts.reduce((sum, debt) => sum + Number(debt.principalAmount) - Number(debt.paidAmount), 0);
    return {
      title: `${shop.name} Debt Report`,
      subtitle: "Customer balances, due dates, reminder state, and collection status.",
      metrics: [{ label: "Open balance", value: currency(openBalance, shop.currency) }, { label: "Debts", value: debts.length }],
      columns: ["Customer", "Status", "Principal", "Paid", "Balance", "Due", "Reminders"],
      rows: debts.map((debt) => [
        debt.customer.name,
        titleCase(debt.status),
        currency(debt.principalAmount.toString(), shop.currency),
        currency(debt.paidAmount.toString(), shop.currency),
        currency(Number(debt.principalAmount) - Number(debt.paidAmount), shop.currency),
        shortDate(debt.dueDate),
        debt.reminderCount,
      ]),
    };
  }

  if (module === "pos") {
    const orders = await prisma.order.findMany({ where: { shopId, channel: "POS", createdAt }, include: { customer: true, payments: true }, orderBy: { createdAt: "desc" }, take: 1000 });
    return {
      title: `${shop.name} POS Sales`,
      subtitle: "In-store sales with payment status and customer record.",
      metrics: [{ label: "Orders", value: orders.length }, { label: "Revenue", value: currency(orders.reduce((sum, order) => sum + Number(order.totalAmount), 0), shop.currency) }],
      columns: ["Receipt", "Customer", "Status", "Payment", "Total", "Date"],
      rows: orders.map((order) => [
        order.receiptNumber,
        order.customer?.name ?? "Walk-in",
        titleCase(order.status),
        order.payments.map((payment) => titleCase(payment.method)).join(" / ") || "None",
        currency(order.totalAmount.toString(), shop.currency),
        shortDate(order.createdAt),
      ]),
    };
  }

  if (module === "payments") {
    const payments = await prisma.payment.findMany({
      where: { order: { shopId }, createdAt },
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const successful = payments.filter((payment) => payment.status === "SUCCESS");
    return {
      title: `${shop.name} Payment Modes`,
      subtitle: "Cash, card, mobile money, and store credit movement by receipt.",
      metrics: [
        { label: "Payments", value: payments.length },
        { label: "Successful value", value: currency(successful.reduce((sum, payment) => sum + Number(payment.amount), 0), shop.currency) },
      ],
      columns: ["Receipt", "Customer", "Method", "Status", "Amount", "Reference", "Date"],
      rows: payments.map((payment) => [
        payment.order.receiptNumber,
        payment.order.customer?.name ?? "Walk-in",
        titleCase(payment.method),
        titleCase(payment.status),
        currency(payment.amount.toString(), shop.currency),
        payment.providerReference ?? "",
        shortDate(payment.createdAt),
      ]),
    };
  }

  if (module === "suppliers") {
    const suppliers = await prisma.supplier.findMany({ where: { shopId, createdAt }, include: { supplierOrders: true }, orderBy: { name: "asc" } });
    return {
      title: `${shop.name} Supplier Report`,
      subtitle: "Suppliers, portal accounts, lead times, terms, and order volume.",
      metrics: [{ label: "Suppliers", value: suppliers.length }, { label: "Active", value: suppliers.filter((supplier) => supplier.isActive).length }],
      columns: ["Supplier", "Contact", "Phone", "Categories", "Terms", "Lead time", "Orders"],
      rows: suppliers.map((supplier) => [
        supplier.name,
        supplier.contactName ?? "",
        supplier.phone ?? "",
        supplier.categories ?? "",
        supplier.paymentTerms ?? "",
        `${supplier.leadTimeDays} day(s)`,
        supplier.supplierOrders.length,
      ]),
    };
  }

  if (module === "closing") {
    const closings = await prisma.dailyClosing.findMany({ where: { shopId, businessDate: createdAt }, include: { closedBy: true }, orderBy: { businessDate: "desc" }, take: 1000 });
    return {
      title: `${shop.name} Daily Closing Report`,
      subtitle: "Manual cash counts compared with system expectation.",
      metrics: [{ label: "Closings", value: closings.length }, { label: "Total sales", value: currency(closings.reduce((sum, closing) => sum + Number(closing.totalSales), 0), shop.currency) }],
      columns: ["Date", "Closed by", "Sales", "Expected cash", "Manual cash", "Difference", "Status"],
      rows: closings.map((closing) => [
        shortDate(closing.businessDate),
        closing.closedBy.name,
        currency(closing.totalSales.toString(), shop.currency),
        currency(closing.expectedCash.toString(), shop.currency),
        currency(closing.manualCash.toString(), shop.currency),
        currency(closing.cashDifference.toString(), shop.currency),
        titleCase(closing.status),
      ]),
    };
  }

  if (module === "catalog") {
    const products = await prisma.product.findMany({ where: { shopId, createdAt }, include: { category: true, variants: true }, orderBy: { name: "asc" } });
    return {
      title: `${shop.name} Catalog Report`,
      subtitle: "Product pricing, category, SKU count, stock, and low-stock thresholds.",
      metrics: [{ label: "Products", value: products.length }, { label: "Total stock", value: products.reduce((sum, product) => sum + product.variants.reduce((inner, variant) => inner + variant.stockQty, 0), 0) }],
      columns: ["Product", "Category", "Base price", "Variants", "Stock", "Low stock"],
      rows: products.map((product) => [
        product.name,
        product.category.name,
        currency(product.basePrice.toString(), shop.currency),
        product.variants.length,
        product.variants.reduce((sum, variant) => sum + variant.stockQty, 0),
        product.lowStockThreshold,
      ]),
    };
  }

  if (module === "messages") {
    const messages = await prisma.customerMessage.findMany({ where: { shopId, createdAt }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 1000 });
    return {
      title: `${shop.name} Messaging Report`,
      subtitle: "SMS, WhatsApp, email, debt reminders, receipts, and provider state.",
      metrics: [{ label: "Messages", value: messages.length }, { label: "Sent", value: messages.filter((message) => message.status === "SENT").length }],
      columns: ["Customer", "Channel", "Status", "Recipient", "Message", "Date"],
      rows: messages.map((message) => [
        message.customer?.name ?? message.recipientName ?? "Direct",
        message.channel,
        titleCase(message.status),
        message.recipientPhone ?? message.recipientEmail ?? "",
        message.body,
        shortDate(message.createdAt),
      ]),
    };
  }

  if (module === "network") {
    const [links, outgoing, incoming] = await Promise.all([
      prisma.shopNetworkLink.findMany({
        where: { OR: [{ requesterShopId: shopId }, { partnerShopId: shopId }], createdAt },
        include: { requesterShop: true, partnerShop: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.shopNetworkOrder.findMany({
        where: { requesterShopId: shopId, createdAt },
        include: { partnerShop: true, items: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.shopNetworkOrder.findMany({
        where: { partnerShopId: shopId, createdAt },
        include: { requesterShop: true, items: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);
    const rows = [
      ...outgoing.map((order) => [
        "Outgoing",
        order.orderNumber,
        order.partnerShop.name,
        titleCase(order.status),
        currency(order.totalAmount.toString(), shop.currency),
        order.items.map((item) => `${item.quantity}x ${item.description}`).join(", "),
        shortDate(order.createdAt),
      ]),
      ...incoming.map((order) => [
        "Incoming",
        order.orderNumber,
        order.requesterShop.name,
        titleCase(order.status),
        currency(order.totalAmount.toString(), shop.currency),
        order.items.map((item) => `${item.quantity}x ${item.description}`).join(", "),
        shortDate(order.createdAt),
      ]),
    ];
    return {
      title: `${shop.name} Shop Network`,
      subtitle: "Linked shops, requests, exchanges, fulfillment status, and transfer value.",
      metrics: [
        { label: "Linked shops", value: links.length },
        { label: "Outgoing", value: outgoing.length },
        { label: "Incoming", value: incoming.length },
      ],
      columns: ["Direction", "Order", "Partner", "Status", "Value", "Items", "Date"],
      rows,
    };
  }

  if (module === "designs") {
    const jobs = await prisma.designJob.findMany({
      where: { shopId, updatedAt: createdAt },
      include: { customer: true, order: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });
    return {
      title: `${shop.name} Design Jobs`,
      subtitle: "Artwork queue, machine profiles, export formats, customers, and linked orders.",
      metrics: [
        { label: "Designs", value: jobs.length },
        { label: "Ready or sent", value: jobs.filter((job) => job.status === "READY" || job.status === "SENT_TO_MACHINE").length },
      ],
      columns: ["Title", "Customer", "Order", "Machine", "Format", "Status", "Updated"],
      rows: jobs.map((job) => [
        job.title,
        job.customer?.name ?? "",
        job.order?.receiptNumber ?? "",
        job.machineProfile ?? "Generic SVG",
        job.exportFormat ?? "SVG",
        titleCase(job.status),
        shortDate(job.updatedAt),
      ]),
    };
  }

  const logs = await prisma.auditLog.findMany({ where: { shopId, createdAt }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 1000 });
  return {
    title: `${shop.name} Activity Report`,
    subtitle: "Audit log of staff and system actions.",
    metrics: [{ label: "Events", value: logs.length }],
    columns: ["Action", "User", "Entity", "Entity ID", "Date"],
    rows: logs.map((log) => [
      log.action,
      log.user?.email ?? "System",
      log.entityType,
      log.entityId ?? "",
      shortDate(log.createdAt),
    ]),
  };
}

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.shopId) return NextResponse.json({ error: "Missing shop context." }, { status: 403 });

  const exportModule = (request.nextUrl.searchParams.get("module") ?? "pos") as ExportModule;
  const format = request.nextUrl.searchParams.get("format") ?? "pdf";
  const fromValue = request.nextUrl.searchParams.get("from");
  const toValue = request.nextUrl.searchParams.get("to");
  const from = fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : null;
  const to = toValue ? new Date(`${toValue}T23:59:59.999Z`) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) {
    return NextResponse.json({ error: "Invalid export date range." }, { status: 400 });
  }
  const allowedModules: ExportModule[] = ["debts", "pos", "payments", "suppliers", "closing", "catalog", "messages", "activity", "network", "designs"];
  if (!allowedModules.includes(exportModule)) return NextResponse.json({ error: "Unsupported export module." }, { status: 400 });
  if (!canExport(exportModule, session)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

  const query = request.nextUrl.searchParams.get("q")?.slice(0, 120) ?? "";
  const data = applySearch(await exportData(exportModule, session.shopId, { from, to, query }), query);
  const filename = `${exportModule}-${fromValue ?? "all"}-to-${toValue ?? "present"}`;

  if (format === "word") {
    return new NextResponse(Uint8Array.from(await buildTableDocx(data)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  }

  if (format === "pdf") {
    return new NextResponse(buildTablePdf(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  if (format === "excel") {
    return new NextResponse(Uint8Array.from(await buildTableXlsx(data)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const csv = buildTableCsv(data);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.${format === "excel" ? "xls" : "csv"}"`,
    },
  });
}
