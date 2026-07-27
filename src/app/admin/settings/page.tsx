import { AlertTriangle, CheckCircle2, Database, Globe2, MessageSquareText, Settings, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { compactNumber } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

function statusCard(title: string, configured: boolean, detail: string, icon: React.ReactNode) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-cyan-300">{icon}</span><Badge tone={configured ? "green" : "orange"}>{configured ? "Configured" : "Attention"}</Badge></div><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></div>;
}

export default async function SettingsPage() {
  await requirePlatformPermission("settings");
  const [failedMessages, shops, users] = await Promise.all([
    prisma.customerMessage.count({ where: { status: "FAILED" } }),
    prisma.shop.count(),
    prisma.user.count(),
  ]);

  const paymentConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const smsConfigured = smsProvider === "arkesel" ? Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID) : Boolean(process.env.SMS_API_URL && process.env.SMS_API_TOKEN);
  const whatsappProvider = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  const whatsappConfigured = whatsappProvider !== "console";
  const mediaProvider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase();
  const durableMedia = mediaProvider !== "local" && Boolean(process.env.MEDIA_PUBLIC_URL);
  const appUrlConfigured = Boolean(process.env.APP_URL);

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Platform configuration</p><h1 className="mt-2 text-3xl font-semibold">Settings</h1><p className="mt-2 text-sm text-slate-600">Review production integrations and operating configuration without exposing secret keys.</p></div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statusCard("Paystack payments", paymentConfigured, paymentConfigured ? "The server payment key is present. Continue using test transactions and webhook verification before live financial changes." : "No Paystack server key is configured, so online payment settlement cannot operate.", <WalletCards size={20} />)}
        {statusCard("SMS delivery", smsConfigured, smsConfigured ? `${smsProvider} credentials are present. Delivery health should still be verified with a controlled test message.` : "SMS is running without a production delivery configuration; messages may remain console-only.", <MessageSquareText size={20} />)}
        {statusCard("WhatsApp delivery", whatsappConfigured, whatsappConfigured ? `${whatsappProvider} is selected. Confirm templates and recipient consent before production messaging.` : "WhatsApp is in console or inactive mode and will not deliver production messages.", <MessageSquareText size={20} />)}
        {statusCard("Durable media", durableMedia, durableMedia ? `${mediaProvider} storage and a public media URL are configured.` : "Media is local or missing a durable public URL; Railway redeployments may not preserve local uploads.", <Database size={20} />)}
        {statusCard("Public application URL", appUrlConfigured, appUrlConfigured ? "APP_URL is configured for public redirects, metadata and trusted-origin handling." : "APP_URL is missing, which can make redirects and public metadata depend on runtime defaults.", <Globe2 size={20} />)}
        {statusCard("Message queue health", failedMessages === 0, failedMessages === 0 ? "No failed customer messages are currently recorded." : `${compactNumber(failedMessages)} customer message records are marked failed and should be reviewed from Support.`, failedMessages === 0 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel p-5"><div className="flex items-center gap-2"><Settings size={19} /><h2 className="text-xl font-semibold">Platform operating profile</h2></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tenant shops</dt><dd className="mt-2 text-xl font-semibold">{compactNumber(shops)}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">User accounts</dt><dd className="mt-2 text-xl font-semibold">{compactNumber(users)}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Staff login</dt><dd className="mt-2 font-semibold">Private ID or work email</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Buyer recovery</dt><dd className="mt-2 font-semibold">Phone password + SMS recovery</dd></div></dl></div>
        <div className="panel p-5"><div className="flex items-center gap-2"><AlertTriangle size={19} /><h2 className="text-xl font-semibold">Operational playbook</h2></div><div className="mt-5 space-y-3 text-sm leading-6 text-slate-600"><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Payment failure:</strong> confirm provider reference and webhook state before asking a customer to retry.</p><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Pickup dispute:</strong> verify receipt number, pickup code, user identity and recorded timestamp.</p><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Delayed production:</strong> open Support, update the order state and leave an auditable note.</p><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Return complaint:</strong> use Support for approval or rejection; financial refunds and stock exchanges remain dedicated workflows.</p></div></div>
      </section>
    </div>
  );
}
