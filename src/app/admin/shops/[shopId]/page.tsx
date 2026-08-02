import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard, Landmark, Puzzle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { rejectShopCredentialsAction, toggleShopAction, updateShopModulesAction, verifyShopCredentialsAction } from "@/app/admin/actions";
import { updateShopPaymentRoutingAction } from "@/app/admin/shops/[shopId]/payment-actions";
import { CORE_BUSINESS_MODULES, OPTIONAL_BUSINESS_MODULES, businessModuleEnabled } from "@/lib/business-modules";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { checkShopPaystackSubaccount } from "@/lib/integration-health";
import { businessTypeLabel } from "@/lib/brand";

const paymentMessages: Record<string, string> = {
  updated: "Payment routing was verified and updated.",
  invalid: "The payment-routing form was incomplete or invalid.",
  "provider-rejected": "Paystack could not verify that subaccount. No routing change was saved.",
};

type Props = {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ credential?: string; payment?: string }>;
};

function maskAccount(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, "") ?? "";
  return normalized.length >= 4 ? `••••${normalized.slice(-4)}` : "Not provided";
}

export default async function AdminShopDetailPage({ params, searchParams }: Props) {
  const { shopId } = await params;
  const query = (await searchParams) ?? {};
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      users: { orderBy: { createdAt: "desc" } },
      paymentConfig: true,
      _count: { select: { products: true, orders: true, customers: true, debts: true, suppliers: true, dailyClosings: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 8, include: { user: true } },
    },
  });

  if (!shop) notFound();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [sales, paystackHealth] = await Promise.all([
    prisma.order.aggregate({
      where: { shopId: shop.id, createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    checkShopPaystackSubaccount(shop.paymentConfig?.paystackSubaccountCode),
  ]);

  const paymentMessage = query.payment ? paymentMessages[query.payment] : null;
  const platformCharge = shop.paymentConfig?.paystackTransactionCharge
    ? currency(Number(shop.paymentConfig.paystackTransactionCharge) / 100, shop.currency)
    : "No flat charge";
  const routingHealthy = paystackHealth.state === "healthy";

  return (
    <div className="space-y-5">
      {query.credential ? <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">One-time owner credential</p><p className="mt-2 break-all font-mono text-base">{query.credential}</p><p className="mt-2 text-xs">Copy this password now and send it through a trusted channel. It is not written to application logs.</p><Link className="mt-3 inline-flex font-semibold underline" href={`/admin/shops/${shop.id}`}>I have copied it</Link></div> : null}
      {paymentMessage ? <div className={`rounded-xl border p-4 text-sm ${query.payment === "updated" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>{paymentMessage}</div> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link className="text-sm font-semibold text-slate-500 hover:text-slate-950" href="/admin">Back to shops</Link>
          <h1 className="mt-2 text-3xl font-semibold">{shop.name}</h1>
          <p className="mt-1 text-sm text-slate-600">/{shop.slug} - network {shop.networkCode ?? "not assigned"} - owner Login ID {shop.staffLoginId ?? "not assigned"} - created {shortDate(shop.createdAt)}</p>
        </div>
        <form action={toggleShopAction}><input type="hidden" name="shopId" value={shop.id} /><Button variant={shop.isActive ? "outline" : "primary"}>{shop.isActive ? "Suspend shop" : "Reactivate shop"}</Button></form>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Business type" value={businessTypeLabel(shop.businessType)} />
        <StatCard label="Plan" value={shop.planTier} />
        <StatCard label="Status" value={shop.isActive ? "Active" : "Suspended"} />
        <StatCard label="Verification" value={titleCase(shop.verificationStatus)} />
        <StatCard label="Products" value={String(shop._count.products)} />
        <StatCard label="30-day sales" value={currency(sales._sum.totalAmount?.toString() ?? "0", shop.currency)} />
        <StatCard label="Renewal" value={shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"} />
        <StatCard label="Suppliers" value={String(shop._count.suppliers)} />
        <StatCard label="Debt records" value={String(shop._count.debts)} />
        <StatCard label="Closings" value={String(shop._count.dailyClosings)} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-5"><p className="text-sm font-semibold uppercase text-slate-500">Shop access</p><h2 className="mt-2 text-xl font-semibold">{shop.staffLoginId ?? "Missing staff ID"}</h2><p className="mt-2 text-sm text-slate-500">The owner can use this Login ID or their email on the sign-in page. Individual staff accounts use their own Login ID when assigned, otherwise their email.</p></div>
        <div className="panel p-5"><p className="text-sm font-semibold uppercase text-slate-500">Store payment account</p><h2 className="mt-2 text-xl font-semibold">{routingHealthy ? "Verified subaccount" : titleCase(paystackHealth.state)}</h2><p className="mt-2 text-sm text-slate-500">{paystackHealth.detail}</p></div>
        <div className="panel p-5"><p className="text-sm font-semibold uppercase text-slate-500">Mobile money</p><h2 className="mt-2 text-xl font-semibold">{shop.paymentConfig?.shopMomoNumber ?? "Not set"}</h2><p className="mt-2 text-sm text-slate-500">{shop.paymentConfig?.shopMomoNetwork ?? "Shop can add its own settlement line."}</p></div>
        <div className="panel p-5"><p className="text-sm font-semibold uppercase text-slate-500">Billing</p><h2 className="mt-2 text-xl font-semibold">{shop.billingCycle}</h2><p className="mt-2 text-sm text-slate-500">{shop.subscriptionStatus} - {shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</p></div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Puzzle size={19} /><p className="text-sm font-semibold uppercase text-slate-500">Business modules</p></div>
            <h2 className="mt-2 text-xl font-semibold">Choose only the tools this business needs</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Core sales, orders, items, customers, payments, reports and settings always remain available. Optional tools disappear from the business navigation when disabled and still require an assigned plan feature when one is listed.</p>
          </div>
          <Badge tone="blue">{shop.enabledModules.length} enabled</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CORE_BUSINESS_MODULES.map((module) => (
            <div key={module.key} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-emerald-950">{module.label}</h3><Badge tone="green">Always on</Badge></div>
              <p className="mt-2 text-sm leading-5 text-emerald-900/80">{module.description}</p>
            </div>
          ))}
        </div>

        <form action={updateShopModulesAction} className="mt-5">
          <input type="hidden" name="shopId" value={shop.id} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {OPTIONAL_BUSINESS_MODULES.map((module) => {
              const available = module.status === "AVAILABLE";
              const enabled = businessModuleEnabled(shop.enabledModules, module.key);
              return (
                <label key={module.key} className={`rounded-xl border p-4 ${available ? enabled ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50 text-slate-500"}`}>
                  <div className="flex items-start gap-3">
                    {available ? <input type="checkbox" name="enabledModules" value={module.key} defaultChecked={enabled} className="mt-1 h-5 w-5 rounded border-slate-300" /> : <span className="mt-1 grid h-5 w-5 place-items-center rounded border border-slate-300 text-[9px] font-bold">—</span>}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{module.label}</span><Badge tone={available ? enabled ? "blue" : "neutral" : "orange"}>{available ? enabled ? "Enabled" : "Optional" : "Planned"}</Badge></span>
                      <span className="mt-2 block text-sm leading-5 text-slate-600">{module.description}</span>
                      <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{module.requiredFeature ? `Plan feature: ${module.requiredFeature.replaceAll("_", " ")}` : "Future phase"}</span>
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
          <Button className="mt-4">Save enabled modules</Button>
        </form>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase text-slate-500">Payment ownership and routing</p><h2 className="mt-2 text-xl font-semibold">Store settlement + ESM platform account</h2><p className="mt-2 text-sm leading-6 text-slate-500">Customer sales are initialized on ESM’s administrator Paystack integration and assigned to this business’s subaccount. The business receives its settlement; the configured ESM charge stays with the administrator main account.</p></div><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${routingHealthy ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{routingHealthy ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}</span></div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Paystack business</p><p className="mt-2 font-semibold">{paystackHealth.metadata.businessName ?? "Not verified"}</p></div>
            <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Provider environment</p><p className="mt-2 font-semibold">{paystackHealth.metadata.domain ? titleCase(paystackHealth.metadata.domain) : "Unknown"}</p></div>
            <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Settlement destination</p><p className="mt-2 font-semibold">{paystackHealth.metadata.settlementBank ?? shop.paymentConfig?.settlementBank ?? "Not provided"}</p><p className="mt-1 text-sm text-slate-500">{paystackHealth.metadata.settlementAccountName ?? shop.paymentConfig?.settlementAccountName ?? "Account name missing"} · {paystackHealth.metadata.settlementAccountMasked ?? maskAccount(shop.paymentConfig?.settlementAccount)}</p></div>
            <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">ESM administrator share</p><p className="mt-2 font-semibold">{platformCharge}</p><p className="mt-1 text-sm text-slate-500">Paystack fee borne by {shop.paymentConfig?.paystackChargeBearer === "account" ? "ESM main account" : "shop subaccount"}.</p></div>
          </div>

          <form action={updateShopPaymentRoutingAction} className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <input type="hidden" name="shopId" value={shop.id} />
            <div className="flex items-center gap-2"><CreditCard size={18} /><h3 className="font-semibold">Administrator-controlled route</h3></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Shop Paystack subaccount</span><input className="field" name="paystackSubaccountCode" placeholder="ACCT_xxxxxxxxx" defaultValue={shop.paymentConfig?.paystackSubaccountCode ?? ""} /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">ESM flat charge in pesewas</span><input className="field" name="paystackTransactionCharge" type="number" min="0" max="100000000" placeholder="0" defaultValue={shop.paymentConfig?.paystackTransactionCharge ?? ""} /></label>
              <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Who bears Paystack transaction fees?</span><select className="field" name="paystackChargeBearer" defaultValue={shop.paymentConfig?.paystackChargeBearer === "account" ? "account" : "subaccount"}><option value="subaccount">Shop subaccount</option><option value="account">ESM administrator main account</option></select></label>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Saving a non-empty subaccount first performs a read-only Paystack verification. Failed verification does not replace the current route.</p>
            <Button className="mt-4">Verify and save payment route</Button>
          </form>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2"><Landmark size={19} /><h2 className="text-xl font-semibold">Settlement responsibility</h2></div>
          <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Shop money:</strong> paid to the verified bank account attached to this shop’s Paystack subaccount.</p>
            <p className="rounded-xl bg-white p-4"><strong className="text-slate-900">ESM money:</strong> platform charges, subscription payments and communication-credit purchases belong to the administrator main account.</p>
            <p className="rounded-xl bg-white p-4"><strong className="text-slate-900">No shared balances:</strong> one shop’s sales must never be represented as another shop’s balance or manually transferred through another tenant.</p>
            <p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Disputes:</strong> use the Paystack reference, order, webhook event and shop ID together before any reconciliation or refund decision.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase text-slate-500">Credential verification</p><h2 className="mt-2 text-xl font-semibold">{titleCase(shop.verificationStatus)}</h2><p className="mt-2 text-sm text-slate-500">Verify shops only after their business details, owner identity, and settlement details are acceptable.</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold" href={`/admin/shops/${shop.id}/legal-document`}>Legal document</Link><Link className="rounded-[8px] border border-[#ded8cd] bg-white px-3 py-2 text-sm font-semibold" href={`/admin/shops/${shop.id}/id-card`}>Seller ID card</Link></div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{[["Legal name", shop.legalBusinessName], ["Registration", shop.businessRegistrationNumber], ["Tax ID", shop.taxIdentificationNumber], ["Owner ID", shop.ownerGovernmentId], ["Contact", shop.credentialContactName], ["Phone", shop.credentialPhone], ["Email", shop.credentialEmail], ["Address", shop.credentialAddress]].map(([label, value]) => <div key={label} className="rounded-[8px] bg-white p-3 text-sm"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value || "Not provided"}</p></div>)}</div>
          {shop.credentialDocumentUrl ? <Link className="mt-4 inline-flex text-sm font-semibold text-[var(--shop-primary)]" href={shop.credentialDocumentUrl}>Open credential document</Link> : null}
          <div className="mt-5 flex flex-wrap gap-2"><form action={verifyShopCredentialsAction}><input type="hidden" name="shopId" value={shop.id} /><Button>Verify shop</Button></form><form action={rejectShopCredentialsAction}><input type="hidden" name="shopId" value={shop.id} /><Button variant="outline">Reject credentials</Button></form></div>
        </div>
        <div className="panel p-5"><p className="text-sm font-semibold uppercase text-slate-500">Verification record</p><h2 className="mt-2 text-xl font-semibold">{shop.verifiedAt ? shortDate(shop.verifiedAt) : "Not verified"}</h2><p className="mt-2 text-sm text-slate-500">Verification makes a shop eligible for the public marketplace. The shop owner still chooses whether the storefront is visible, ordering is paused, or the shop is fully online.</p><div className="mt-4 grid gap-2 text-sm"><div className="rounded-[8px] bg-white px-3 py-2">Network code: <span className="font-semibold">{shop.networkCode ?? "Not assigned"}</span></div><div className="rounded-[8px] bg-white px-3 py-2">Owner Login ID: <span className="font-semibold">{shop.staffLoginId ?? "Not assigned"}</span></div></div></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Users</h2></div><table className="w-full text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{shop.users.map((user) => <tr key={user.id}><td className="p-3"><p className="font-semibold">{user.name}</p><p className="text-slate-500">{user.email}</p></td><td className="p-3"><Badge>{titleCase(user.role)}</Badge></td><td className="p-3"><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Disabled"}</Badge></td></tr>)}</tbody></table></div>
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Recent audit log</h2></div><div className="divide-y divide-[#ded8cd] bg-white">{shop.auditLogs.map((log) => <div key={log.id} className="p-4 text-sm"><p className="font-semibold">{log.action}</p><p className="text-slate-500">{log.user?.email ?? "System"} - {shortDate(log.createdAt)}</p></div>)}</div></div>
      </section>
    </div>
  );
}
