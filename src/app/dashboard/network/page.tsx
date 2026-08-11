import { Link2, PackagePlus, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createNetworkOrderAction, fulfillNetworkOrderAction, linkShopByCodeAction } from "@/app/dashboard/network/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

type Props = { searchParams?: Promise<{ error?: string }> };

const networkErrors: Record<string, string> = {
  code: "Enter a valid partner shop code.",
  shop: "That shop cannot be linked. Check the code and confirm the partner shop is active, verified and enabled for marketplace trading.",
  order: "Check the partner order details. Choose a partner, enter a description, positive quantity and valid unit price.",
  link: "That partner link or selected item is no longer available. Refresh the page and choose again.",
  fulfill: "Choose a valid incoming network order to fulfil.",
  "fulfill-changed": "This order could not be fulfilled because it changed, was already handled, or no longer has enough linked stock. Refresh and review it before trying again.",
};

export default async function NetworkPage({ searchParams }: Props) {
  await requireRole(permissions.network);
  const params = (await searchParams) ?? {};
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [links, outgoing, incoming] = await Promise.all([
    prisma.shopNetworkLink.findMany({
      where: { OR: [{ requesterShopId: shop.id }, { partnerShopId: shop.id }] },
      include: { requesterShop: true, partnerShop: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shopNetworkOrder.findMany({
      where: { requesterShopId: shop.id },
      include: { partnerShop: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.shopNetworkOrder.findMany({
      where: { partnerShopId: shop.id },
      include: { requesterShop: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const partners = links.map((link) => link.requesterShopId === shop.id ? link.partnerShop : link.requesterShop);
  const partnerProducts = partners.length
    ? await prisma.productVariant.findMany({
        where: { product: { shopId: { in: partners.map((partner) => partner.id) } } },
        include: { product: { include: { shop: true } } },
        orderBy: { sku: "asc" },
        take: 200,
      })
    : [];

  return (
    <div className="space-y-4 sm:space-y-5">
      {params.error && networkErrors[params.error] ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{networkErrors[params.error]}</div> : null}
      <div><h1 className="text-2xl font-semibold">Shop network</h1><p className="mt-2 text-sm text-slate-500">Link with another shop using its unique code, then request and fulfil items securely.</p></div>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr] xl:gap-5">
        <div className="space-y-4 sm:space-y-5">
          <div className="panel p-4 sm:p-5">
            <div className="flex items-center gap-2"><Share2 size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Your shop code</h2></div>
            <p className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-xl font-semibold tracking-wide sm:text-2xl">{shop.networkCode ?? "Not assigned yet"}</p>
            <p className="mt-3 text-sm text-slate-500">Share this code only with trusted shops you want to trade with.</p>
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><Link2 size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Link another shop</h2></div>
            <form action={linkShopByCodeAction} className="space-y-3"><input className="field uppercase" name="partnerCode" placeholder="Partner shop code" required /><Button className="w-full">Connect shop</Button></form>
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><PackagePlus size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Request partner item</h2></div>
            <form action={createNetworkOrderAction} className="space-y-3">
              <select className="field" name="partnerShopId" required><option value="">Partner shop</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select>
              <select className="field" name="productVariantId"><option value="">No product link</option>{partnerProducts.map((variant) => <option key={variant.id} value={variant.id}>{variant.product.shop.name}: {variant.sku} - {variant.product.name}</option>)}</select>
              <input className="field" name="description" placeholder="Item description" required />
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2"><input className="field" name="quantity" type="number" min="1" placeholder="Qty" required /><input className="field" name="unitPrice" type="number" min="0" step="0.01" placeholder="Unit price" required /></div>
              <textarea className="field min-h-20" name="notes" placeholder="Exchange, transfer, payment, or delivery notes" />
              <Button className="w-full">Request item</Button>
            </form>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Connected shops</h2></div>
            <div className="grid gap-3 p-3 sm:p-5 md:grid-cols-2">
              {partners.map((partner) => <article key={partner.id} className="min-w-0 rounded-xl border border-[#ded8cd] bg-white p-4"><p className="truncate font-semibold">{partner.name}</p><p className="mt-1 truncate text-sm text-slate-500">/{partner.slug}</p><Badge className="mt-3" tone="green">Linked</Badge></article>)}
              {!partners.length ? <p className="text-sm text-slate-500">No linked shops yet.</p> : null}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2 xl:gap-5">
            <div className="panel overflow-hidden">
              <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Outgoing requests</h2></div>
              <div className="divide-y divide-[#ded8cd] bg-white">
                {outgoing.map((order) => <article key={order.id} className="min-w-0 p-3 text-sm sm:p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate font-semibold">{order.orderNumber}</p><Badge className="shrink-0" tone={order.status === "FULFILLED" ? "green" : "orange"}>{titleCase(order.status)}</Badge></div><p className="mt-1 text-slate-500">{order.partnerShop.name} · {currency(order.totalAmount.toString(), shop.currency)}</p><p className="mt-2 break-words text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.description}`).join(", ")}</p><p className="mt-2 text-xs text-slate-400">{shortDate(order.createdAt)}</p></article>)}
                {!outgoing.length ? <p className="p-4 text-sm text-slate-500">No outgoing requests.</p> : null}
              </div>
            </div>

            <div className="panel overflow-hidden">
              <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Incoming requests</h2></div>
              <div className="divide-y divide-[#ded8cd] bg-white">
                {incoming.map((order) => <article key={order.id} className="min-w-0 p-3 text-sm sm:p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate font-semibold">{order.orderNumber}</p><Badge className="shrink-0" tone={order.status === "FULFILLED" ? "green" : "orange"}>{titleCase(order.status)}</Badge></div><p className="mt-1 text-slate-500">{order.requesterShop.name} · {currency(order.totalAmount.toString(), shop.currency)}</p><p className="mt-2 break-words text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.description}`).join(", ")}</p><form className="mt-3" action={fulfillNetworkOrderAction}><input type="hidden" name="orderId" value={order.id} /><Button variant="outline" className="w-full" disabled={order.status === "FULFILLED"}>Fulfill request</Button></form></article>)}
                {!incoming.length ? <p className="p-4 text-sm text-slate-500">No incoming requests.</p> : null}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
