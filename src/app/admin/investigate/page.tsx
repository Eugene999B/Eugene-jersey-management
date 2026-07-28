import { Prisma } from "@prisma/client";
import Link from "next/link";
import { CreditCard, FileClock, MessagesSquare, PackageSearch, Search, Store, Truck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { currency, shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ q?: string }> };

export default async function InvestigationSearchPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("support");
  const query = params.q?.trim() ?? "";
  const active = query.length >= 2;
  const text = { contains: query, mode: Prisma.QueryMode.insensitive };

  const [shops, users, suppliers, orders, payments, messages, audits] = active
    ? await Promise.all([
        platformDb.shop.findMany({
          where: { OR: [{ name: text }, { slug: text }, { legalBusinessName: text }, { businessRegistrationNumber: text }, { credentialEmail: text }, { credentialPhone: text }, { staffLoginId: text }] },
          select: { id: true, name: true, slug: true, isActive: true, verificationStatus: true, subscriptionStatus: true, planTier: true, storefrontEnabled: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
        platformDb.user.findMany({
          where: { OR: [{ name: text }, { email: text }, { adminLoginId: text }, { phone: text }, { staffTitle: text }] },
          select: { id: true, shopId: true, name: true, email: true, adminLoginId: true, role: true, isActive: true, lastLoginAt: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
        platformDb.supplier.findMany({
          where: { OR: [{ name: text }, { contactName: text }, { email: text }, { phone: text }, { categories: text }] },
          select: { id: true, shopId: true, name: true, contactName: true, email: true, phone: true, isActive: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
        platformDb.order.findMany({
          where: { OR: [{ receiptNumber: text }, { paystackReference: text }, { publicAccessToken: query }] },
          select: { id: true, shopId: true, receiptNumber: true, status: true, channel: true, totalAmount: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        platformDb.payment.findMany({
          where: { OR: [{ providerReference: text }, { gatewayResponse: text }, { order: { receiptNumber: text } }] },
          select: { id: true, providerReference: true, status: true, method: true, amount: true, createdAt: true, order: { select: { id: true, shopId: true, receiptNumber: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        platformDb.customerMessage.findMany({
          where: { OR: [{ recipientName: text }, { recipientPhone: text }, { recipientEmail: text }, { subject: text }, { body: text }, { providerReference: text }] },
          select: { id: true, shopId: true, channel: true, status: true, recipientName: true, subject: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        platformDb.auditLog.findMany({
          where: { OR: [{ action: text }, { entityType: text }, { entityId: text }] },
          select: { id: true, shopId: true, action: true, entityType: true, entityId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ])
    : [[], [], [], [], [], [], []];

  const shopIds = [...new Set([
    ...shops.map((item) => item.id),
    ...users.map((item) => item.shopId),
    ...suppliers.map((item) => item.shopId),
    ...orders.map((item) => item.shopId),
    ...payments.map((item) => item.order.shopId),
    ...messages.map((item) => item.shopId),
    ...audits.map((item) => item.shopId),
  ].filter((value): value is string => Boolean(value)))];
  const relatedShops = shopIds.length ? await platformDb.shop.findMany({ where: { id: { in: shopIds } }, select: { id: true, name: true } }) : [];
  const shopNames = new Map(relatedShops.map((shop) => [shop.id, shop.name]));
  const resultCount = shops.length + users.length + suppliers.length + orders.length + payments.length + messages.length + audits.length;

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Platform support</p><h1 className="mt-2 text-3xl font-semibold">Investigation search</h1><p className="mt-2 text-sm text-slate-600">Find businesses, people and operational references without impersonating a tenant or exposing provider secrets.</p></div>
      <form className="panel flex flex-col gap-3 p-5 sm:flex-row"><input className="field flex-1" name="q" defaultValue={query} minLength={2} placeholder="Shop, Login ID, email, phone, receipt, provider reference or audit action" /><button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"><Search size={17} /> Investigate</button></form>
      {!active ? <div className="panel p-8 text-center text-sm text-slate-500">Enter at least two characters. Exact references and Login IDs produce the safest results.</div> : null}
      {active ? <p className="text-sm font-semibold text-slate-600">{resultCount} matching records for “{query}”</p> : null}

      {shops.length ? <ResultSection icon={<Store size={19} />} title="Shops">
        {shops.map((shop) => <Link key={shop.id} href={`/admin/investigate/shops/${shop.id}`} className="block rounded-xl border border-[#ded8cd] bg-white p-4 transition hover:border-[#0f766e]"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{shop.name}</p><p className="mt-1 text-sm text-slate-500">/{shop.slug} · {shop.planTier} · {titleCase(shop.subscriptionStatus)}</p></div><div className="flex gap-2"><Badge tone={shop.isActive ? "green" : "red"}>{shop.isActive ? "Active" : "Suspended"}</Badge><Badge tone={shop.storefrontEnabled ? "blue" : "neutral"}>{shop.storefrontEnabled ? "Public" : "Private"}</Badge></div></div></Link>)}
      </ResultSection> : null}

      {users.length ? <ResultSection icon={<Users size={19} />} title="Users and Login IDs">
        {users.map((user) => <article key={user.id} className="rounded-xl border border-[#ded8cd] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{user.name}</p><p className="mt-1 text-sm text-slate-500">{user.adminLoginId ?? "No Login ID"} · {user.email} · {titleCase(user.role)}</p><p className="mt-1 text-xs text-slate-400">Last login {user.lastLoginAt ? shortDate(user.lastLoginAt) : "never"}</p></div><div className="flex flex-wrap gap-2">{user.shopId ? <Link className="text-sm font-semibold text-[#0f766e] hover:underline" href={`/admin/investigate/shops/${user.shopId}`}>{shopNames.get(user.shopId) ?? "Open shop"}</Link> : <Badge>Platform account</Badge>}<Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Suspended"}</Badge></div></div></article>)}
      </ResultSection> : null}

      {suppliers.length ? <ResultSection icon={<Truck size={19} />} title="Suppliers">
        {suppliers.map((supplier) => <article key={supplier.id} className="rounded-xl border border-[#ded8cd] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{supplier.name}</p><p className="mt-1 text-sm text-slate-500">{supplier.contactName ?? "No contact"} · {supplier.email ?? supplier.phone ?? "No contact channel"}</p></div><Link className="text-sm font-semibold text-[#0f766e] hover:underline" href={`/admin/investigate/shops/${supplier.shopId}`}>{shopNames.get(supplier.shopId) ?? "Open shop"}</Link></div><Link className="mt-3 inline-flex text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${supplier.shopId}&supplierId=${supplier.id}&linkedEntityType=Supplier&linkedEntityId=${supplier.id}`}>Open supplier case</Link></article>)}
      </ResultSection> : null}

      {orders.length ? <ResultSection icon={<PackageSearch size={19} />} title="Orders">
        {orders.map((order) => <article key={order.id} className="rounded-xl border border-[#ded8cd] bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{order.receiptNumber}</p><p className="mt-1 text-sm text-slate-500">{shopNames.get(order.shopId) ?? "Unknown shop"} · {titleCase(order.channel)} · {currency(order.totalAmount.toString())}</p></div><Badge tone={order.status === "COMPLETED" ? "green" : order.status === "CANCELLED" ? "red" : "orange"}>{titleCase(order.status)}</Badge></div><div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold"><Link className="text-[#0f766e] hover:underline" href={`/admin/investigate/shops/${order.shopId}`}>Investigate shop</Link><Link className="text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${order.shopId}&linkedEntityType=Order&linkedEntityId=${order.id}`}>Open order case</Link></div></article>)}
      </ResultSection> : null}

      {payments.length ? <ResultSection icon={<CreditCard size={19} />} title="Payments">
        {payments.map((payment) => <article key={payment.id} className="rounded-xl border border-[#ded8cd] bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold break-all">{payment.providerReference ?? "No provider reference"}</p><p className="mt-1 text-sm text-slate-500">{payment.order.receiptNumber} · {titleCase(payment.method)} · {currency(payment.amount.toString())}</p></div><Badge tone={payment.status === "SUCCESS" ? "green" : payment.status === "FAILED" ? "red" : "orange"}>{titleCase(payment.status)}</Badge></div><Link className="mt-3 inline-flex text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${payment.order.shopId}&linkedEntityType=Payment&linkedEntityId=${payment.id}`}>Open payment case</Link></article>)}
      </ResultSection> : null}

      {messages.length ? <ResultSection icon={<MessagesSquare size={19} />} title="Messages">
        {messages.map((message) => <article key={message.id} className="rounded-xl border border-[#ded8cd] bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{message.subject ?? message.recipientName ?? "Customer message"}</p><p className="mt-1 text-sm text-slate-500">{shopNames.get(message.shopId) ?? "Unknown shop"} · {titleCase(message.channel)} · {shortDate(message.createdAt)}</p></div><Badge tone={message.status === "SENT" ? "green" : message.status === "FAILED" ? "red" : "orange"}>{titleCase(message.status)}</Badge></div><Link className="mt-3 inline-flex text-xs font-semibold text-slate-600 hover:underline" href={`/admin/support/cases/new?shopId=${message.shopId}&linkedEntityType=CustomerMessage&linkedEntityId=${message.id}`}>Open messaging case</Link></article>)}
      </ResultSection> : null}

      {audits.length ? <ResultSection icon={<FileClock size={19} />} title="Audit activity">
        {audits.map((entry) => <article key={entry.id} className="rounded-xl border border-[#ded8cd] bg-white p-4"><p className="font-semibold">{entry.action}</p><p className="mt-1 text-sm text-slate-500">{entry.entityType} · {entry.entityId ?? "No entity ID"} · {shortDate(entry.createdAt)}</p>{entry.shopId ? <Link className="mt-3 inline-flex text-xs font-semibold text-[#0f766e] hover:underline" href={`/admin/investigate/shops/${entry.shopId}`}>{shopNames.get(entry.shopId) ?? "Investigate shop"}</Link> : null}</article>)}
      </ResultSection> : null}

      {active && !resultCount ? <div className="panel p-8 text-center text-sm text-slate-500">No platform records matched that search.</div> : null}
    </div>
  );
}

function ResultSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="panel p-5"><div className="mb-4 flex items-center gap-2">{icon}<h2 className="text-xl font-semibold">{title}</h2></div><div className="grid gap-3 lg:grid-cols-2">{children}</div></section>;
}
