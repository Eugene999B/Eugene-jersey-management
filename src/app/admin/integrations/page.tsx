import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cloud,
  CreditCard,
  Database,
  MessageSquareText,
  RefreshCw,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";
import {
  getProductionIntegrationHealth,
  type IntegrationHealthCheck,
  type IntegrationHealthState,
} from "@/lib/integration-health";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

function tone(state: IntegrationHealthState): "green" | "orange" | "red" {
  if (state === "healthy") return "green";
  if (state === "unreachable") return "red";
  return "orange";
}

function stateLabel(state: IntegrationHealthState) {
  if (state === "healthy") return "Healthy";
  if (state === "attention") return "Attention";
  if (state === "unreachable") return "Unreachable";
  return "Not configured";
}

function icon(check: IntegrationHealthCheck) {
  if (check.key === "database") return <Database size={20} />;
  if (check.key === "paystack") return <CreditCard size={20} />;
  if (check.key === "arkesel" || check.key === "whatsapp") return <MessageSquareText size={20} />;
  if (check.key === "media") return <Cloud size={20} />;
  return <Clock3 size={20} />;
}

function metadataRows(check: IntegrationHealthCheck) {
  if (check.key === "paystack") {
    const balances = Array.isArray(check.metadata.balances)
      ? check.metadata.balances as Array<{ currency?: string; amount?: number }>
      : [];
    return [
      ["Account", String(check.metadata.accountLabel ?? "EJM administrator main account")],
      ["Environment", String(check.metadata.mode ?? "unknown")],
      ["Available balances", balances.length
        ? balances.map((item) => currency(item.amount ?? 0, item.currency ?? "GHS")).join(" · ")
        : "Not returned"],
    ];
  }
  if (check.key === "arkesel") {
    return [
      ["Sender ID", String(check.metadata.sender ?? "Not configured")],
      ["SMS balance", check.metadata.smsBalance === null || check.metadata.smsBalance === undefined ? "Not returned" : compactNumber(Number(check.metadata.smsBalance))],
      ["Main balance", String(check.metadata.mainBalance ?? "Not returned")],
    ];
  }
  if (check.key === "whatsapp") {
    return [
      ["Provider", String(check.metadata.provider ?? "console")],
      ["Health host", String(check.metadata.healthHost ?? "Not configured")],
      ["HTTP status", String(check.metadata.httpStatus ?? "Not checked")],
    ];
  }
  if (check.key === "media") {
    return [
      ["Provider", String(check.metadata.provider ?? "local")],
      ["Bucket", String(check.metadata.bucket ?? "Not configured")],
      ["Public URL", check.metadata.publicUrlConfigured ? "Configured" : "Not confirmed"],
    ];
  }
  if (check.key === "reservations") {
    return [
      ["Expected interval", `${String(check.metadata.expectedIntervalMinutes ?? 15)} minutes`],
      ["Last success", check.metadata.lastSucceededAt ? shortDate(String(check.metadata.lastSucceededAt)) : "Never"],
      ["Last duration", check.metadata.lastDurationMs === null || check.metadata.lastDurationMs === undefined ? "Not recorded" : `${compactNumber(Number(check.metadata.lastDurationMs))} ms`],
    ];
  }
  return [["Response time", `${check.responseTimeMs} ms`]];
}

export default async function AdminIntegrationsPage() {
  await requirePlatformPermission("settings");
  const [health, shops, configuredShopAccounts, cardEnabledShops, failedMessages] = await Promise.all([
    getProductionIntegrationHealth(),
    prisma.shop.count({ where: { isActive: true } }),
    prisma.shopPaymentConfig.count({ where: { paystackSubaccountCode: { not: null } } }),
    prisma.shopPaymentConfig.count({ where: { allowCard: true } }),
    prisma.customerMessage.count({ where: { status: "FAILED" } }),
  ]);

  const launchReady = health.summary.unreachable === 0
    && health.summary.unconfigured === 0
    && health.summary.attention === 0;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-[#081528] p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Release #17 · Production Integration Health</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Provider and settlement control centre</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">These checks are read-only. They verify authentication and reachability without creating payments, sending messages, uploading files or releasing stock.</p>
          </div>
          <Link href="/admin/integrations" prefetch={false} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-white transition hover:bg-white/10"><RefreshCw size={17} />Run checks again</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Overall state</p><p className="mt-2 text-2xl font-semibold">{launchReady ? "Ready" : "Needs attention"}</p><Badge className="mt-3" tone={launchReady ? "green" : "orange"}>{launchReady ? "All checks healthy" : "Do not enable broadly"}</Badge></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Healthy</p><p className="mt-2 text-3xl font-semibold text-emerald-700">{health.summary.healthy}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Attention</p><p className="mt-2 text-3xl font-semibold text-amber-700">{health.summary.attention + health.summary.unconfigured}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Unreachable</p><p className="mt-2 text-3xl font-semibold text-red-700">{health.summary.unreachable}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Failed messages</p><p className="mt-2 text-3xl font-semibold">{compactNumber(failedMessages)}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {health.checks.map((check) => (
          <article key={check.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${check.state === "healthy" ? "bg-emerald-100 text-emerald-700" : check.state === "unreachable" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{icon(check)}</span>
              <Badge tone={tone(check.state)}>{stateLabel(check.state)}</Badge>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{check.label}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{check.detail}</p>
            <dl className="mt-4 grid gap-2 text-sm">
              {metadataRows(check).map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-2"><dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
            <p className="mt-4 text-xs text-slate-400">Checked {new Date(check.checkedAt).toLocaleString("en-GB")} · {check.responseTimeMs} ms</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="panel p-5">
          <div className="flex items-center gap-2"><CreditCard size={19} /><h2 className="text-xl font-semibold">Payment ownership model</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><Store className="text-emerald-700" size={20} /><p className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-emerald-800">Each store owns its settlement</p><p className="mt-2 text-sm leading-6 text-emerald-900">Customer payments for a store are assigned to that store’s verified Paystack subaccount and bank destination.</p></div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><CreditCard className="text-cyan-700" size={20} /><p className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-cyan-800">Administrator owns platform income</p><p className="mt-2 text-sm leading-6 text-cyan-900">EJM charges, subscriptions and communication-credit purchases belong to the administrator main Paystack account.</p></div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Active shops</dt><dd className="mt-2 text-2xl font-semibold">{compactNumber(shops)}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Subaccounts assigned</dt><dd className="mt-2 text-2xl font-semibold">{compactNumber(configuredShopAccounts)}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Card enabled</dt><dd className="mt-2 text-2xl font-semibold">{compactNumber(cardEnabledShops)}</dd></div></dl>
          <p className="mt-4 text-sm leading-6 text-slate-600">A store can update its settlement details and accepted methods, but only a platform administrator with Billing permission can assign the Paystack subaccount, EJM charge and transaction-fee bearer.</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2"><Activity size={19} /><h2 className="text-xl font-semibold">Launch rules</h2></div>
          <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <p className="flex gap-3 rounded-xl bg-white p-4">{health.summary.unreachable === 0 ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18} /> : <AlertTriangle className="mt-0.5 shrink-0 text-red-700" size={18} />}No provider may be unreachable when its production feature is enabled.</p>
            <p className="flex gap-3 rounded-xl bg-white p-4">{configuredShopAccounts >= cardEnabledShops ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18} /> : <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={18} />}Every card-enabled shop must have its own assigned subaccount.</p>
            <p className="flex gap-3 rounded-xl bg-white p-4"><Clock3 className="mt-0.5 shrink-0 text-slate-700" size={18} />The reservation-release job must report on its expected schedule before online stock reservations are trusted.</p>
            <p className="flex gap-3 rounded-xl bg-white p-4"><MessageSquareText className="mt-0.5 shrink-0 text-slate-700" size={18} />Provider reachability does not replace a controlled delivery test, consent check or approved WhatsApp template.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
