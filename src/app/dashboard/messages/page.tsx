import { Mail, MessageCircle, Send, Smartphone, WalletCards } from "lucide-react";
import { CommunicationCreditChannel, NotificationChannel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { purchaseCommunicationCreditsAction } from "@/app/dashboard/messages/credit-actions";
import { sendMessageAction } from "@/app/dashboard/messages/actions";
import { shopCommunicationCreditDashboard } from "@/lib/communication-credits";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { hasRole, permissions } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type MessagesPageProps = {
  searchParams?: Promise<{ error?: string; credits?: string; channel?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Check the recipient, channel and message body.",
  "sms-credits": "This shop has no SMS credits. An owner or manager can purchase a configured package below.",
  "whatsapp-credits": "This shop has no WhatsApp credits. An owner or manager can purchase a configured package below.",
  "credit-package": "That communication credit package is unavailable or incomplete.",
  "credit-paystack-unavailable": "Paystack is not configured for administrator-owned credit purchases.",
  "credit-checkout": "The communication credit checkout could not be initialized.",
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const session = await requireRole(permissions.messages);
  const params = (await searchParams) ?? {};
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [customers, messages, threads, credits] = await Promise.all([
    prisma.customer.findMany({ where: { shopId: shop.id }, orderBy: { name: "asc" } }),
    prisma.customerMessage.findMany({
      where: { shopId: shop.id },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.customerThread.findMany({
      where: { shopId: shop.id },
      include: { customer: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    shopCommunicationCreditDashboard(shop.id),
  ]);

  const smsSent = messages.filter((message) => message.channel === "SMS").length;
  const whatsappSent = messages.filter((message) => message.channel === "WHATSAPP").length;
  const canPurchaseCredits = hasRole(session, permissions.settings);
  const walletMap = new Map(credits.wallets.map((wallet) => [wallet.channel, wallet]));
  const channelOptions = [
    { channel: NotificationChannel.SMS, Icon: Smartphone },
    { channel: NotificationChannel.WHATSAPP, Icon: MessageCircle },
    { channel: NotificationChannel.EMAIL, Icon: Mail },
  ];

  return (
    <div className="space-y-5">
      {params.error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{errorMessages[params.error] ?? "The message or credit action could not be completed."}</div> : null}
      {params.credits === "success" ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Communication credits purchased successfully. The verified units are now available.</div> : null}
      {params.credits === "failed" || params.credits === "invalid" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">The credit payment was not verified. No units were added to this shop.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {[CommunicationCreditChannel.SMS, CommunicationCreditChannel.WHATSAPP].map((channel) => {
          const wallet = walletMap.get(channel);
          const Icon = channel === CommunicationCreditChannel.SMS ? Smartphone : MessageCircle;
          return (
            <article key={channel} className="panel p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-3 text-cyan-800"><Icon size={20} /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{channel} wallet</p><p className="mt-1 text-3xl font-semibold">{(wallet?.balance ?? 0).toLocaleString("en-GB")}</p></div></div><WalletCards className="text-slate-300" size={22} /></div>
              <p className="mt-3 text-sm text-slate-500">{(wallet?.lifetimePurchased ?? 0).toLocaleString("en-GB")} purchased · {(wallet?.lifetimeUsed ?? 0).toLocaleString("en-GB")} used · {(wallet?.lifetimeRefunded ?? 0).toLocaleString("en-GB")} refunded</p>
            </article>
          );
        })}
      </section>

      {canPurchaseCredits ? (
        <section className="panel p-4 sm:p-5">
          <div className="flex items-center gap-2"><WalletCards size={19} className="text-[var(--shop-primary)]" /><h2 className="text-xl font-semibold">Purchase communication credits</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-500">Configured packages are paid through the EJM administrator Paystack account. Store sales still settle separately to this shop’s own subaccount.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {credits.packages.map((creditPackage) => (
              <article key={creditPackage.id} className="rounded-xl border border-[#ded8cd] bg-white p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{creditPackage.name}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{creditPackage.channel} · version {creditPackage.version}</p></div><Badge>{creditPackage.channel}</Badge></div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{creditPackage.description || "Configured communication package."}</p>
                <p className="mt-3 text-2xl font-semibold">{currency(creditPackage.price?.toString() ?? 0, creditPackage.currency)}</p>
                <p className="mt-1 text-sm text-slate-500">{((creditPackage.creditUnits ?? 0) + creditPackage.bonusUnits).toLocaleString("en-GB")} total credits{creditPackage.bonusUnits ? ` · ${creditPackage.bonusUnits.toLocaleString("en-GB")} bonus` : ""}</p>
                <form action={purchaseCommunicationCreditsAction} className="mt-4"><input type="hidden" name="packageId" value={creditPackage.id} /><Button type="submit" className="w-full">Buy with Paystack</Button></form>
              </article>
            ))}
            {!credits.packages.length ? <p className="rounded-xl border border-dashed border-[#ded8cd] p-4 text-sm text-slate-500">No configured public packages are available yet. The platform administrator must configure, activate and publish them first.</p> : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr] xl:gap-5">
        <section className="panel h-fit p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Send size={18} className="text-[var(--shop-primary)]" /><h1 className="text-xl font-semibold">Send customer message</h1></div>
          <p className="mb-4 text-sm leading-6 text-slate-500 sm:mb-5">SMS and WhatsApp use one credit only when a real provider is configured. Email and console-mode queues do not consume credits.</p>
          <form action={sendMessageAction} className="space-y-3">
            <select className="field" name="customerId"><option value="">No saved customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `- ${customer.phone}` : ""}</option>)}</select>
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">{channelOptions.map((option) => <label key={option.channel} className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-[#ded8cd] bg-white px-1 py-2 text-[11px] font-semibold sm:flex-row sm:gap-2 sm:px-2 sm:py-3 sm:text-sm"><input className="sr-only" type="radio" name="channel" value={option.channel} defaultChecked={option.channel === NotificationChannel.SMS} /><option.Icon size={17} /> {option.channel}</label>)}</div>
            <input className="field" name="recipientPhone" placeholder="Phone override, e.g. +233..." />
            <input className="field" name="recipientEmail" type="email" placeholder="Email override" />
            <input className="field" name="subject" placeholder="Subject (email or internal label)" />
            <textarea className="field min-h-32" name="body" placeholder="Message body" required />
            <Button type="submit" className="w-full">Send or queue message</Button>
          </form>
          <div className="mt-5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 text-sm"><div className="rounded-xl bg-white p-3"><p className="text-slate-500">SMS records</p><p className="mt-1 text-2xl font-semibold">{smsSent}</p></div><div className="rounded-xl bg-white p-3"><p className="text-slate-500">WhatsApp records</p><p className="mt-1 text-2xl font-semibold">{whatsappSent}</p></div></div>
        </section>

        <section className="panel min-w-0 overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-xl font-semibold">Communication history</h2><p className="mt-1 text-sm text-slate-500">Every outgoing reminder, receipt and credit failure is tracked here.</p></div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {threads.map((thread) => <article key={thread.id} className="border-b border-[#ded8cd] bg-[#f6f4ef] p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{thread.subject}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{thread.customer?.name ?? "Portal customer"} · {thread.messages[0]?.body ?? "No message"}</p></div><Badge className="shrink-0" tone={thread.status === "OPEN" ? "blue" : "green"}>{thread.status}</Badge></div></article>)}
            {messages.map((message) => <article key={message.id} className="min-w-0 p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{message.customer?.name ?? message.recipientName ?? "Direct recipient"}</p><p className="break-all text-sm text-slate-500">{message.recipientPhone ?? message.recipientEmail ?? "No contact saved"}</p></div><div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:gap-2"><Badge tone={message.status === "SENT" ? "green" : message.status === "FAILED" ? "red" : "orange"}>{titleCase(message.status)}</Badge><Badge>{message.channel}</Badge></div></div><p className="mt-3 break-words text-sm leading-6 text-slate-700">{message.body}</p><p className="mt-3 break-all text-xs text-slate-400">{shortDate(message.createdAt)} · {message.providerReference ?? "No provider reference"}</p></article>)}
            {!messages.length && !threads.length ? <p className="p-5 text-sm text-slate-500">No messages have been sent yet.</p> : null}
          </div>
        </section>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-xl font-semibold">Recent credit purchases</h2></div><div className="divide-y divide-[#ded8cd] bg-white">{credits.purchases.map((purchase) => <article key={purchase.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{purchase.channel} · {purchase.totalUnits.toLocaleString("en-GB")} credits</p><p className="mt-1 text-sm text-slate-500">{currency(purchase.amount.toString(), purchase.currency)} · package version {purchase.packageVersion}</p></div><Badge tone={purchase.status === "SUCCESS" ? "green" : purchase.status === "FAILED" ? "red" : "orange"}>{purchase.status}</Badge></div><p className="mt-2 break-all text-xs text-slate-400">{shortDate(purchase.createdAt)} · {purchase.providerReference}</p></article>)}{!credits.purchases.length ? <p className="p-4 text-sm text-slate-500">No credit purchases yet.</p> : null}</div></div>
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-xl font-semibold">Credit ledger</h2></div><div className="divide-y divide-[#ded8cd] bg-white">{credits.ledger.map((entry) => <article key={entry.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{entry.channel} · {titleCase(entry.type)}</p><p className="mt-1 text-sm text-slate-500">{entry.reason}</p></div><div className="text-right"><p className={`font-semibold ${entry.delta > 0 ? "text-emerald-700" : "text-slate-900"}`}>{entry.delta > 0 ? "+" : ""}{entry.delta}</p><p className="text-xs text-slate-400">Balance {entry.balanceAfter}</p></div></div><p className="mt-2 text-xs text-slate-400">{shortDate(entry.createdAt)}</p></article>)}{!credits.ledger.length ? <p className="p-4 text-sm text-slate-500">No credit ledger entries yet.</p> : null}</div></div>
      </section>
    </div>
  );
}
