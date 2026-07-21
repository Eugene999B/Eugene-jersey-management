import Image from "next/image";
import Link from "next/link";
import { Bike, CreditCard, PackageCheck, ShoppingBag, Store, Tag, Trash2, Wallet } from "lucide-react";
import { checkoutCartAction, updateCartItemAction } from "@/app/cart/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/buyer-session";
import { currency } from "@/lib/format";
import { firstProductImage } from "@/lib/product-images";

type Props = {
  searchParams?: Promise<{ shop?: string; error?: string }>;
};

const errors: Record<string, string> = {
  invalid: "Check the checkout details and try again.",
  delivery: "Delivery checkout needs a delivery address.",
  closed: "This shop is not accepting online cart checkout now.",
  empty: "Your cart is empty.",
  stock: "One or more items no longer has enough stock.",
  payment: "Online payment is not configured for this shop. Choose cash pickup or contact the shop.",
};

export default async function CartPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const buyer = await getBuyerSession();
  if (!buyer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-4">
        <section className="panel max-w-md p-6 text-center">
          <ShoppingBag className="mx-auto text-[#0f766e]" size={34} />
          <h1 className="mt-4 text-2xl font-semibold">Login to view your cart</h1>
          <p className="mt-2 text-sm text-slate-600">Cart checkout is tied to a verified phone number.</p>
          <Link className="mt-5 inline-flex rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white" href="/buyer/login?next=/cart">
            Buyer login
          </Link>
        </section>
      </main>
    );
  }

  const items = await prisma.buyerCartItem.findMany({
    where: { buyerId: buyer.id, shopId: params.shop || undefined },
    include: {
      shop: { include: { paymentConfig: true } },
      productVariant: { include: { product: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const deliveryZones = await prisma.deliveryZone.findMany({
    where: { shopId: { in: [...new Set(items.map((item) => item.shopId))] }, isActive: true },
    orderBy: { name: "asc" },
  });

  const groups = Object.values(items.reduce<Record<string, typeof items>>((acc, item) => {
    acc[item.shopId] ??= [];
    acc[item.shopId].push(item);
    return acc;
  }, {}));

  return (
    <main className="min-h-screen bg-[#f6f4ef]">
      <header className="border-b border-[#ded8cd] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/shops" className="flex items-center gap-3">
            <div className="rounded-[8px] bg-[#111827] p-3 text-white"><ShoppingBag size={21} /></div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#0f766e]">Buyer cart</p>
              <h1 className="text-xl font-semibold">{buyer.name}</h1>
            </div>
          </Link>
          <Link className="rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold" href="/shops">
            Continue shopping
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {params.error ? (
          <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {errors[params.error] ?? errors.invalid}
          </div>
        ) : null}

        {!groups.length ? (
          <div className="rounded-[8px] border border-[#ded8cd] bg-white p-6 text-sm text-slate-600">
            Your cart is empty.
          </div>
        ) : null}

        <div className="grid gap-5">
          {groups.map((group) => {
            const shop = group[0].shop;
            const zones = deliveryZones.filter((zone) => zone.shopId === shop.id);
            const subtotal = group.reduce((sum, item) => sum + Number(item.productVariant.priceOverride ?? item.productVariant.product.basePrice) * item.quantity, 0);
            const onlinePaymentReady = Boolean(process.env.PAYSTACK_SECRET_KEY && shop.paymentConfig?.allowCard);
            return (
              <article key={shop.id} className="overflow-hidden rounded-[8px] border border-[#ded8cd] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8cd] bg-[#111827] p-4 text-white">
                  <div className="flex items-center gap-3">
                    <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={42} height={42} className="rounded-[8px]" />
                    <div>
                      <p className="text-xs font-semibold uppercase text-white/55">Checkout from</p>
                      <h2 className="text-lg font-semibold">{shop.name}</h2>
                    </div>
                  </div>
                  <Badge tone="orange">{currency(subtotal, shop.currency)}</Badge>
                </div>

                <div className="grid gap-5 p-4 lg:grid-cols-[1fr_390px]">
                  <div className="space-y-3">
                    {group.map((item) => {
                      const product = item.productVariant.product;
                      const image = firstProductImage(product.images);
                      const price = Number(item.productVariant.priceOverride ?? product.basePrice);
                      return (
                        <div key={item.id} className="grid gap-3 rounded-[8px] border border-[#ded8cd] p-3 sm:grid-cols-[88px_1fr_auto]">
                          <div className="aspect-square rounded-[8px] bg-[#f6f4ef] bg-cover bg-center" style={image ? { backgroundImage: `url(${image})` } : undefined} />
                          <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.productVariant.sku}</p>
                            <p className="mt-2 text-sm font-semibold">{currency(price, shop.currency)} each</p>
                          </div>
                          <form action={updateCartItemAction} className="grid gap-2 sm:w-32">
                            <input type="hidden" name="itemId" value={item.id} />
                            <input className="field" name="quantity" type="number" min="0" max="100" defaultValue={item.quantity} />
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline">Save</Button>
                              <button className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-red-200 bg-red-50 text-red-700" name="quantity" value="0" title="Remove">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </form>
                        </div>
                      );
                    })}
                  </div>

                  <form action={checkoutCartAction} className="h-fit rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-4">
                    <input type="hidden" name="shopId" value={shop.id} />
                    <div className="mb-4 flex items-center gap-2">
                      <PackageCheck size={18} className="text-[#0f766e]" />
                      <h3 className="font-semibold">Checkout</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                        <input type="radio" name="fulfillmentType" value="PICKUP" defaultChecked />
                        <Store size={16} /> Pickup
                      </label>
                      <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                        <input type="radio" name="fulfillmentType" value="DELIVERY" />
                        <Bike size={16} /> Delivery
                      </label>
                    </div>
                    <select className="field mt-3" name="deliveryZoneId" defaultValue="">
                      <option value="">Delivery zone optional</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} - {currency(zone.fee.toString(), shop.currency)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input className="field" name="deliveryAddress" placeholder="Delivery address" />
                      <input className="field" name="deliveryCity" placeholder="City" />
                      <input className="field" name="deliveryArea" placeholder="Area" />
                      <input className="field" name="deliveryNotes" placeholder="Delivery note" />
                    </div>
                    <label className="mt-3 flex items-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-3">
                      <Tag size={16} className="text-slate-400" />
                      <input className="min-h-11 flex-1 bg-transparent text-sm outline-none uppercase" name="couponCode" placeholder="Coupon code" />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {onlinePaymentReady ? <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                        <input type="radio" name="paymentChoice" value="PAYSTACK" defaultChecked />
                        <CreditCard size={16} /> Card/MoMo
                      </label> : null}
                      <label className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-2 text-sm font-semibold">
                        <input type="radio" name="paymentChoice" value="CASH" defaultChecked={!onlinePaymentReady} />
                        <Wallet size={16} /> Cash pickup
                      </label>
                    </div>
                    {!onlinePaymentReady ? <p className="mt-2 text-xs font-medium text-amber-700">Online payment is not configured for this shop. No card payment will be collected.</p> : null}
                    <Button className="mt-4 w-full"><ShoppingBag size={16} /> Checkout cart</Button>
                    <p className="mt-3 text-xs text-slate-500">Online cart checkout does not support credit. Credit remains POS-only.</p>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
