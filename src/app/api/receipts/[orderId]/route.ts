import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { currency } from "@/lib/format";
import { permissions } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireRole(permissions.orderFinance);
  const { orderId } = await context.params;
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      shopId: session.shopId ?? undefined,
    },
    include: {
      shop: true,
      customer: true,
      items: { include: { productVariant: { include: { product: true } } } },
      payments: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

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
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        td { border-bottom: 1px solid #eee; padding: 8px 0; font-size: 13px; }
        .total { font-weight: 700; font-size: 18px; }
        @media print { body { padding: 0; } .receipt { border: 0; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <h1>${escapeHtml(order.shop.name)}</h1>
        <p>Receipt: ${escapeHtml(order.receiptNumber)}</p>
        <p>Customer: ${escapeHtml(order.customer?.name ?? "Walk-in")}</p>
        <table>
          ${order.items.map((item) => `
            <tr>
              <td>${item.quantity}x ${escapeHtml(item.productVariant.product.name)}<br><small>${escapeHtml(item.productVariant.sku)}</small></td>
              <td style="text-align:right">${escapeHtml(currency(Number(item.unitPrice) * item.quantity, order.shop.currency))}</td>
            </tr>
          `).join("")}
          <tr><td class="total">Total</td><td class="total" style="text-align:right">${escapeHtml(currency(order.totalAmount.toString(), order.shop.currency))}</td></tr>
        </table>
      </div>
      <script>window.print()</script>
    </body>
  </html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
