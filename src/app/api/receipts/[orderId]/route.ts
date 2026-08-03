import { NextResponse } from "next/server";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { currency, titleCase } from "@/lib/format";
import { permissions } from "@/lib/rbac";
import { requireTenantShopId, withTenantScope } from "@/lib/tenant-scope";
import { productVariantOptionLabel } from "@/lib/product-variants";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

type TenderGatewayDetails = {
  allocatedAmount?: number;
  tenderedAmount?: number | null;
  changeAmount?: number;
  reference?: string | null;
  paymentMode?: "SINGLE" | "MIXED";
};

function tenderGatewayDetails(value: string | null): TenderGatewayDetails {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as TenderGatewayDetails;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireRole(permissions.orderFinance);
  if (!session.shopId) {
    return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  }

  const shopId = requireTenantShopId(session);
  const { orderId } = await context.params;
  const order = await prisma.order.findFirst({
    where: withTenantScope(shopId, { id: orderId }),
    include: {
      shop: true,
      customer: true,
      items: { include: { productVariant: { include: { product: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const paymentRows = order.payments.map((payment) => ({
    ...payment,
    details: tenderGatewayDetails(payment.gatewayResponse),
  }));
  const paidNow = paymentRows
    .filter((payment) => payment.status === PaymentStatus.SUCCESS)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const creditBalance = paymentRows
    .filter((payment) => payment.method === PaymentMethod.STORE_CREDIT && payment.status === PaymentStatus.PENDING)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const cashReceived = paymentRows
    .filter((payment) => payment.method === PaymentMethod.CASH)
    .reduce((sum, payment) => sum + Number(payment.details.tenderedAmount ?? payment.amount), 0);
  const changeAmount = paymentRows.reduce((sum, payment) => sum + Number(payment.details.changeAmount ?? 0), 0);

  const escapeHtml = (value: unknown) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const html = `<!doctype html>
  <html>
    <head>
      <title>Receipt ${escapeHtml(order.receiptNumber)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111827; }
        .receipt { max-width: 420px; margin: auto; border: 1px solid #ded8cd; padding: 18px; }
        h1 { margin: 0; font-size: 22px; }
        h2 { margin: 18px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        td { border-bottom: 1px solid #eee; padding: 8px 0; font-size: 13px; vertical-align: top; }
        small { color: #64748b; }
        .total { font-weight: 700; font-size: 18px; }
        .summary td { font-weight: 700; }
        @media print { body { padding: 0; } .receipt { border: 0; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <h1>${escapeHtml(order.shop.name)}</h1>
        ${order.shop.receiptHeader ? `<p><strong>${escapeHtml(order.shop.receiptHeader)}</strong></p>` : ""}
        <p>Receipt: ${escapeHtml(order.receiptNumber)}</p>
        <p>Customer: ${escapeHtml(order.customer?.name ?? "Walk-in")}</p>
        <table>
          ${order.items.map((item) => `
            <tr>
              <td>${item.quantity}x ${escapeHtml(item.productVariant.product.name)}<br><small>${escapeHtml(productVariantOptionLabel(item.productVariant.attributes))} · ${escapeHtml(item.productVariant.sku)}</small></td>
              <td style="text-align:right">${escapeHtml(currency(Number(item.unitPrice) * item.quantity, order.shop.currency))}</td>
            </tr>
          `).join("")}
          <tr><td class="total">Total</td><td class="total" style="text-align:right">${escapeHtml(currency(order.totalAmount.toString(), order.shop.currency))}</td></tr>
        </table>

        <h2>Payment breakdown</h2>
        <table>
          ${paymentRows.length ? paymentRows.map((payment) => `
            <tr>
              <td>
                <strong>${escapeHtml(titleCase(payment.method))}</strong><br>
                <small>${escapeHtml(titleCase(payment.status))}${payment.providerReference && payment.method !== PaymentMethod.CASH && payment.method !== PaymentMethod.STORE_CREDIT ? ` · ${escapeHtml(payment.providerReference)}` : ""}</small>
                ${payment.method === PaymentMethod.CASH ? `<br><small>Cash received: ${escapeHtml(currency(payment.details.tenderedAmount ?? Number(payment.amount), order.shop.currency))}${Number(payment.details.changeAmount ?? 0) > 0 ? ` · Change: ${escapeHtml(currency(payment.details.changeAmount ?? 0, order.shop.currency))}` : ""}</small>` : ""}
              </td>
              <td style="text-align:right">${escapeHtml(currency(payment.amount.toString(), order.shop.currency))}</td>
            </tr>
          `).join("") : `<tr><td colspan="2">No payment was required.</td></tr>`}
        </table>
        <table class="summary">
          <tr><td>Paid now</td><td style="text-align:right">${escapeHtml(currency(paidNow, order.shop.currency))}</td></tr>
          ${creditBalance > 0 ? `<tr><td>Credit balance</td><td style="text-align:right">${escapeHtml(currency(creditBalance, order.shop.currency))}</td></tr>` : ""}
          ${cashReceived > 0 ? `<tr><td>Cash received</td><td style="text-align:right">${escapeHtml(currency(cashReceived, order.shop.currency))}</td></tr>` : ""}
          ${changeAmount > 0 ? `<tr><td>Change</td><td style="text-align:right">${escapeHtml(currency(changeAmount, order.shop.currency))}</td></tr>` : ""}
        </table>
        ${order.shop.receiptFooter ? `<p style="margin-top:16px;font-size:12px;text-align:center">${escapeHtml(order.shop.receiptFooter)}</p>` : ""}
      </div>
      <script>window.print()</script>
    </body>
  </html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
