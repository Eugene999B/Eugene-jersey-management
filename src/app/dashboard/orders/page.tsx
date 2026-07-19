import { OrderBoard } from "@/components/orders/order-board";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

export default async function OrdersPage() {
  const { session, shop } = await getTenantContext();
  if (!shop) return null;

  const orders = await prisma.order.findMany({
    where: { shopId: shop.id },
    include: {
      customer: true,
      items: {
        include: {
          productVariant: {
            include: { product: true },
          },
        },
      },
    },
    orderBy: [{ rush: "desc" }, { createdAt: "desc" }],
    take: 80,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Production orders</h1>
          <p className="mt-2 text-sm text-slate-500">
            Button-driven Kanban for custom jerseys, services, and production handoff.
          </p>
        </div>
      </div>
      <OrderBoard
        role={session.role}
        currencyCode={shop.currency}
        orders={orders.map((order) => ({
          id: order.id,
          receiptNumber: order.receiptNumber,
          customerName: order.customer?.name ?? "Walk-in customer",
          status: order.status,
          rush: order.rush,
          totalAmount: Number(order.totalAmount),
          items: order.items.map((item) => ({
            name: item.productVariant.product.name,
            sku: item.productVariant.sku,
            quantity: item.quantity,
            personalizationData: item.personalizationData as Record<string, unknown> | null,
          })),
        }))}
      />
    </div>
  );
}
