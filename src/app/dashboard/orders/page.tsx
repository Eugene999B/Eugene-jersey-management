import { OrderBoard } from "@/components/orders/order-board";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

type OrdersPageProps = { searchParams?: Promise<{ q?: string }> };

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q?.trim().slice(0, 80) ?? "";
  const { session, shop } = await getTenantContext();
  if (!shop) return null;

  const orders = await prisma.order.findMany({
    where: {
      shopId: shop.id,
      ...(query ? {
        OR: [
          { receiptNumber: { contains: query, mode: "insensitive" as const } },
          { customer: { is: { name: { contains: query, mode: "insensitive" as const } } } },
          { items: { some: { productVariant: { is: { sku: { contains: query, mode: "insensitive" as const } } } } } },
          { items: { some: { productVariant: { is: { product: { is: { name: { contains: query, mode: "insensitive" as const } } } } } } } },
        ],
      } : {}),
    },
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
        <form className="flex w-full max-w-md gap-2 sm:w-auto">
          <input className="field" name="q" defaultValue={query} placeholder="Search receipt, customer, SKU or item" />
          <button className="rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Search</button>
        </form>
      </div>
      {query ? <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">Showing {orders.length} order(s) matching <strong>{query}</strong>.</p> : null}
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
