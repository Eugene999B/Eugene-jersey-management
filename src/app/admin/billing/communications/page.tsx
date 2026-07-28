import Link from "next/link";
import {
  CommunicationCreditChannel,
  CommunicationCreditPurchaseStatus,
} from "@prisma/client";
import { ArrowLeft, Coins, History, MessageCircle, PackagePlus, Smartphone, Store } from "lucide-react";
import {
  createCommunicationPackageShellAction,
  saveCommunicationPackageAction,
} from "@/app/admin/billing/communication-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { packageUnitPrice } from "@/lib/communication-credits";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    created?: string;
    saved?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "shell-values": "Check the package code, channel, name and description.",
  "shell-code": "That package code already exists.",
  "package-values": "Check the package price, units, bonus, state and written reason.",
  "configured-package-values": "A configured package requires a positive price and positive credit quantity.",
  "public-package-state": "A public package must be configured and active.",
  "package-missing": "That communication package no longer exists.",
  "stale-package": "The package changed while it was being saved. Reload the page and save again.",
};

function channelIcon(channel: CommunicationCreditChannel) {
  return channel === CommunicationCreditChannel.SMS ? Smartphone : MessageCircle;
}

export default async function CommunicationCreditsAdminPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("billing");
  const [packages, recentChanges, wallets, purchases, shops] = await Promise.all([
    prisma.communicationCreditPackage.findMany({ orderBy: [{ channel: "asc" }, { name: "asc" }] }),
    prisma.communicationCreditPackageChangeRequest.findMany({
      include: { package: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.shopCommunicationWallet.findMany({ orderBy: [{ shopId: "asc" }, { channel: "asc" }] }),
    prisma.communicationCreditPurchase.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.shop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const shopMap = new Map(shops.map((shop) => [shop.id, shop.name]));
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const successfulPurchases = purchases.filter((purchase) => purchase.status === CommunicationCreditPurchaseStatus.SUCCESS);
  const revenue = successfulPurchases.reduce((sum, purchase) => sum + Number(purchase.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/billing" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:text-cyan-950"><ArrowLeft size={16} /> Back to subscriptions</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Administrator-owned messaging commerce</p>
          <h1 className="mt-2 text-3xl font-semibold">Communication Credits</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Configure and save SMS and WhatsApp packages immediately, monitor shop balances and reconcile Paystack purchases that settle to the EJM administrator account.</p>
        </div>
      </div>

      {params.error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{errorMessages[params.error] ?? "The communication credit change was not applied."}</div> : null}
      {params.created ? <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Inactive package shell created. Open it below, enter the real commercial terms and save them immediately.</div> : null}
      {params.saved ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Package changes saved immediately and recorded as a new immutable version.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Configured packages" value={`${packages.filter((item) => item.isConfigured).length}/${packages.length}`} icon={<Coins size={20} />} />
        <StatCard label="Recorded changes" value={compactNumber(recentChanges.length)} icon={<History size={20} />} />
        <StatCard label="Credits across shops" value={compactNumber(totalBalance)} icon={<Store size={20} />} />
        <StatCard label="Verified package revenue" value={currency(revenue)} icon={<PackagePlus size={20} />} />
      </section>

      <section className="panel p-5">
        <div className="flex items-center gap-2"><PackagePlus size={20} /><h2 className="text-xl font-semibold">Create inactive package shell</h2></div>
        <p className="mt-2 text-sm text-slate-600">A shell has no price or credit quantity and cannot be purchased until you configure, activate and publish it.</p>
        <form action={createCommunicationPackageShellAction} className="mt-4 grid gap-3 lg:grid-cols-[0.7fr_0.7fr_1fr_1.5fr_auto]">
          <input className="field" name="code" placeholder="SMS-SEASONAL" required />
          <select className="field" name="channel" defaultValue={CommunicationCreditChannel.SMS}>
            <option value={CommunicationCreditChannel.SMS}>SMS</option>
            <option value={CommunicationCreditChannel.WHATSAPP}>WhatsApp</option>
          </select>
          <input className="field" name="name" placeholder="Package name" required />
          <input className="field" name="description" placeholder="Purpose or positioning" />
          <Button type="submit">Create shell</Button>
        </form>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-2xl font-semibold">Authoritative package catalogue</h2><p className="mt-1 text-sm text-slate-600">Only configured, active and public packages appear in shop workspaces.</p></div>
        <div className="grid gap-5 xl:grid-cols-2">
          {packages.map((creditPackage) => {
            const Icon = channelIcon(creditPackage.channel);
            const unitPrice = packageUnitPrice({
              price: creditPackage.price?.toFixed(2) ?? null,
              creditUnits: creditPackage.creditUnits,
              bonusUnits: creditPackage.bonusUnits,
            });
            return (
              <article key={creditPackage.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3"><span className="rounded-xl bg-cyan-50 p-3 text-cyan-800"><Icon size={20} /></span><div><h3 className="text-xl font-semibold">{creditPackage.name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{creditPackage.code} · version {creditPackage.version}</p></div></div>
                  <div className="flex flex-wrap gap-2"><Badge tone={creditPackage.isConfigured ? "green" : "orange"}>{creditPackage.isConfigured ? "Configured" : "Not configured"}</Badge><Badge tone={creditPackage.isPublic ? "blue" : "orange"}>{creditPackage.isPublic ? "Public" : "Private"}</Badge><Badge tone={creditPackage.isActive ? "green" : "red"}>{creditPackage.isActive ? "Active" : "Inactive"}</Badge></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{creditPackage.description || "No description recorded."}</p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Price</dt><dd className="mt-1 font-semibold">{creditPackage.price ? currency(creditPackage.price.toString(), creditPackage.currency) : "Not configured"}</dd></div>
                  <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Credits</dt><dd className="mt-1 font-semibold">{creditPackage.creditUnits === null ? "Not configured" : `${creditPackage.creditUnits.toLocaleString("en-GB")} + ${creditPackage.bonusUnits.toLocaleString("en-GB")} bonus`}</dd></div>
                  <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Per credit</dt><dd className="mt-1 font-semibold">{unitPrice === null ? "Not configured" : currency(unitPrice, creditPackage.currency)}</dd></div>
                </dl>

                <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer font-semibold">Edit and save package terms</summary>
                  <form action={saveCommunicationPackageAction} className="mt-4 space-y-4">
                    <input type="hidden" name="packageId" value={creditPackage.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold">Package name<input className="field mt-1" name="name" defaultValue={creditPackage.name} required /></label>
                      <label className="text-sm font-semibold">Currency<input className="field mt-1 uppercase" name="currency" defaultValue={creditPackage.currency} maxLength={3} required /></label>
                      <label className="text-sm font-semibold">Price<input className="field mt-1" name="price" type="number" min="0" step="0.01" defaultValue={creditPackage.price?.toString() ?? ""} /></label>
                      <label className="text-sm font-semibold">Paid credit units<input className="field mt-1" name="creditUnits" type="number" min="1" defaultValue={creditPackage.creditUnits ?? ""} /></label>
                      <label className="text-sm font-semibold">Bonus units<input className="field mt-1" name="bonusUnits" type="number" min="0" defaultValue={creditPackage.bonusUnits} required /></label>
                    </div>
                    <label className="block text-sm font-semibold">Description<textarea className="field mt-1 min-h-20" name="description" defaultValue={creditPackage.description ?? ""} /></label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isConfigured" defaultChecked={creditPackage.isConfigured} />Configured</label>
                      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isPublic" defaultChecked={creditPackage.isPublic} />Publicly offered</label>
                      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isActive" defaultChecked={creditPackage.isActive} />Active</label>
                    </div>
                    <label className="block text-sm font-semibold">Commercial change reason<textarea className="field mt-1 min-h-20" name="reason" minLength={8} required placeholder="Explain the package price, units, bonus or availability decision." /></label>
                    <Button type="submit">Save changes now</Button>
                  </form>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><History size={20} /><h2 className="text-xl font-semibold">Recent saved package changes</h2></div><p className="mt-1 text-sm text-slate-600">Changes apply immediately for the authenticated administrator and remain fully audited.</p></div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {recentChanges.map((change) => <div key={change.id} className="p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{change.package.name} · version {change.baseVersion + 1}</p><Badge tone="green">APPLIED</Badge></div><p className="mt-1 text-slate-600">{change.reason}</p><p className="mt-2 text-xs text-slate-400">{shortDate(change.createdAt)}</p></div>)}
          {!recentChanges.length ? <p className="p-5 text-sm text-slate-500">No saved package changes yet.</p> : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Shop wallet balances</h2><p className="mt-1 text-sm text-slate-500">Credits are isolated by shop and channel.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Channel</th><th className="p-4">Balance</th><th className="p-4">Purchased</th><th className="p-4">Used</th><th className="p-4">Refunded</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{wallets.map((wallet) => <tr key={wallet.id}><td className="p-4 font-semibold">{shopMap.get(wallet.shopId) ?? wallet.shopId}</td><td className="p-4"><Badge>{wallet.channel}</Badge></td><td className="p-4 font-semibold">{wallet.balance.toLocaleString("en-GB")}</td><td className="p-4">{wallet.lifetimePurchased.toLocaleString("en-GB")}</td><td className="p-4">{wallet.lifetimeUsed.toLocaleString("en-GB")}</td><td className="p-4">{wallet.lifetimeRefunded.toLocaleString("en-GB")}</td></tr>)}</tbody></table></div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Recent Paystack purchases</h2><p className="mt-1 text-sm text-slate-500">Successful purchases credit the wallet once, even when callback and webhook arrive together.</p></div>
          <div className="divide-y divide-[#ded8cd] bg-white">{purchases.map((purchase) => <article key={purchase.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{shopMap.get(purchase.shopId) ?? purchase.shopId} · {purchase.channel}</p><p className="mt-1 text-sm text-slate-500">{purchase.totalUnits.toLocaleString("en-GB")} credits · {currency(purchase.amount.toString(), purchase.currency)} · package version {purchase.packageVersion}</p></div><Badge tone={purchase.status === "SUCCESS" ? "green" : purchase.status === "FAILED" ? "red" : "orange"}>{purchase.status}</Badge></div><p className="mt-2 break-all text-xs text-slate-400">{shortDate(purchase.createdAt)} · {purchase.providerReference}</p></article>)}{!purchases.length ? <p className="p-5 text-sm text-slate-500">No package purchases have been initiated.</p> : null}</div>
        </div>
      </section>
    </div>
  );
}
