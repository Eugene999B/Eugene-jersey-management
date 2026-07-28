import { AlertTriangle, CheckCircle2, Database, Globe2, MessageSquareText, ShieldCheck, WalletCards } from "lucide-react";
import { PlatformGovernanceForm } from "@/components/admin/platform-governance-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { compactNumber } from "@/lib/format";
import { ensurePlatformGovernanceSettings } from "@/lib/platform-governance";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

function statusCard(title: string, configured: boolean, detail: string, icon: React.ReactNode) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-cyan-300">{icon}</span><Badge tone={configured ? "green" : "orange"}>{configured ? "Configured" : "Attention"}</Badge></div><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></div>;
}

export default async function SettingsPage() {
  await requirePlatformPermission("settings");
  const [failedMessages, shops, users, governance] = await Promise.all([
    prisma.customerMessage.count({ where: { status: "FAILED" } }),
    prisma.shop.count(),
    prisma.user.count(),
    ensurePlatformGovernanceSettings(),
  ]);

  const paymentConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const smsConfigured = smsProvider === "arkesel" ? Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID) : Boolean(process.env.SMS_API_URL && process.env.SMS_API_TOKEN);
  const mediaProvider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase();
  const durableMedia = mediaProvider !== "local" && Boolean(process.env.MEDIA_PUBLIC_URL);

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">CEO control centre</p><h1 className="mt-2 text-3xl font-semibold">Platform Governance</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Control platform policies and operating defaults without exposing Paystack, Arkesel, WhatsApp or storage secrets. Provider health remains read-only in Integrations.</p></div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusCard("Paystack", paymentConfigured, paymentConfigured ? "Server credentials are present; settlement routes remain administrator controlled." : "No server key is configured, so online payments remain unavailable.", <WalletCards size={20} />)}
        {statusCard("SMS", smsConfigured, smsConfigured ? `${smsProvider} credentials are present; controlled delivery testing is still required.` : "SMS remains console-only or incomplete.", <MessageSquareText size={20} />)}
        {statusCard("Durable media", durableMedia, durableMedia ? `${mediaProvider} storage has a public URL.` : "Durable storage is not fully configured.", <Database size={20} />)}
        {statusCard("Message queue", failedMessages === 0, failedMessages === 0 ? "No failed customer messages are currently recorded." : `${compactNumber(failedMessages)} customer messages require support review.`, failedMessages === 0 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />)}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><Globe2 size={18} /><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tenant shops</p><p className="mt-1 text-2xl font-semibold">{compactNumber(shops)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><ShieldCheck size={18} /><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">User accounts</p><p className="mt-1 text-2xl font-semibold">{compactNumber(users)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Marketplace policy</p><p className="mt-2 font-semibold">{governance.marketplaceEnabled ? "Enabled" : "Disabled"}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Operating state</p><p className="mt-2 font-semibold">{governance.incidentMode ? "Incident mode" : governance.maintenanceMode ? "Maintenance mode" : "Normal operations"}</p></div>
      </section>
      <PlatformGovernanceForm initialSettings={governance} />
    </div>
  );
}
