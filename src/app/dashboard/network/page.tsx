import { Link2, PackagePlus, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createNetworkOrderAction, fulfillNetworkOrderAction, linkShopByCodeAction } from "@/app/dashboard/network/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";

export default async function NetworkPage() {
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Shop network</h1>
        <p className="mt-2 text-sm text-slate-500">Link with another shop using its unique code, then request items from each other.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-5">
          <div className="panel p-5">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-[var(--shop-primary)]" />
              <h2 className="text-lg font-semibold">Your shop code</h2>
            </div>
            <p className="mt-4 rounded-[8px] bg-white p-4 text-2xl font-semibold tracking-wide">{shop.networkCode ?? "Not assigned yet"}</p>
            <p className="mt-3 text-sm text-slate-500">Share this code only with trusted shops you want to trade with.</p>
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Link2 size={18} className="text-[var(--shop-primary)]" />
              <h2 className="text-lg font-semibold">Link another shop</h2>
            </div>
            <form action={linkShopByCodeAction} className="space-y-3">
              <input className="field uppercase" name="partnerCode" placeholder="Partner shop code" required />
              <Button className="w-full">Connect shop</Button>
            </form>
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <PackagePlus size={18} className="text-[var(--shop-primary)]" />
              <h2 className="text-lg font-semibold">Request partner item</h2>
            </div>
            <form action={createNetworkOrderAction} className="space-y-3">
              <select className="field" name="partnerShopId" required>
                <option value="">Partner shop</option>
                {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
              </select>
              <select className="field" name="productVariantId">
                <option value="">No product link</option>
                {partnerProducts.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.product.shop.name}: {variant.sku} - {variant.product.name}</option>
                ))}
              </select>
              <input className="field" name="description" placeholder="Item description" required />
              <div className="grid grid-cols-2 gap-2">
                <input className="field" name="quantity" type="number" min="1" placeholder="Qty" required />
                <input className="field" name="unitPrice" type="number" min="0" step="0.01" placeholder="Unit price" required />
              </div>
              <textarea className="field min-h-20" name="notes" placeholder="Exchange, transfer, payment, or delivery notes" />
              <Button className="w-full">Request item</Button>
            </form>
          </div>
        </div>

        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-[#ded8cd] p-5">
              <h2 className="text-lg font-semibold">Connected shops</h2>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {partners.map((partner) => (
                <article key={partner.id} className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
                  <p className="font-semibold">{partner.name}</p>
                  <p className="mt-1 text-sm text-slate-500">/{partner.slug}</p>
                  <Badge className="mt-3" tone="green">Linked</Badge>
                </article>
              ))}
              {!partners.length ? <p className="text-sm text-slate-500">No linked shops yet.</p> : null}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="panel overflow-hidden">
              <div className="border-b border-[#ded8cd] p-5">
                <h2 className="text-lg font-semibold">Outgoing requests</h2>
              </div>
              <div className="divide-y divide-[#ded8cd] bg-white">
                {outgoing.map((order) => (
                  <div key={order.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{order.orderNumber}</p>
                      <Badge tone={order.status === "FULFILLED" ? "green" : "orange"}>{titleCase(order.status)}</Badge>
                    </div>
                    <p className="mt-1 text-slate-500">{order.partnerShop.name} - {currency(order.totalAmount.toString(), shop.currency)}</p>
                    <p className="mt-2 text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.description}`).join(", ")}</p>
                    <p className="mt-2 text-xs text-slate-400">{shortDate(order.createdAt)}</p>
                  </div>
                ))}
                {!outgoing.length ? <p className="p-4 text-sm text-slate-500">No outgoing requests.</p> : null}
              </div>
            </div>

            <div className="panel overflow-hidden">
              <div className="border-b border-[#ded8cd] p-5">
                <h2 className="text-lg font-semibold">Incoming requests</h2>
              </div>
              <div className="divide-y divide-[#ded8cd] bg-white">
                {incoming.map((order) => (
                  <div key={order.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{order.orderNumber}</p>
                      <Badge tone={order.status === "FULFILLED" ? "green" : "orange"}>{titleCase(order.status)}</Badge>
                    </div>
                    <p className="mt-1 text-slate-500">{order.requesterShop.name} - {currency(order.totalAmount.toString(), shop.currency)}</p>
                    <p className="mt-2 text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.description}`).join(", ")}</p>
                    <form className="mt-3" action={fulfillNetworkOrderAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <Button variant="outline" className="w-full" disabled={order.status === "FULFILLED"}>Fulfill request</Button>
                    </form>
                  </div>
                ))}
                {!incoming.length ? <p className="p-4 text-sm text-slate-500">No incoming requests.</p> : null}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
