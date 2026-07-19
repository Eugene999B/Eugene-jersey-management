import { Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { NotificationChannel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sendMessageAction } from "@/app/dashboard/messages/actions";
import { prisma } from "@/lib/db";
import { shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";

export default async function MessagesPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [customers, messages, threads] = await Promise.all([
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
  ]);

  const smsSent = messages.filter((message) => message.channel === "SMS").length;
  const whatsappSent = messages.filter((message) => message.channel === "WHATSAPP").length;
  const channelOptions = [
    { channel: NotificationChannel.SMS, Icon: Smartphone },
    { channel: NotificationChannel.WHATSAPP, Icon: MessageCircle },
    { channel: NotificationChannel.EMAIL, Icon: Mail },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Send size={18} className="text-[var(--shop-primary)]" />
          <h1 className="text-xl font-semibold">Send customer message</h1>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Send receipts, debt reminders, order updates, promos, or custom notes by SMS, WhatsApp, or email.
        </p>
        <form action={sendMessageAction} className="space-y-3">
          <select className="field" name="customerId">
            <option value="">No saved customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.phone ? `- ${customer.phone}` : ""}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {channelOptions.map((option) => (
              <label key={option.channel} className="flex cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-2 py-3 text-sm font-semibold">
                <input className="sr-only" type="radio" name="channel" value={option.channel} defaultChecked={option.channel === NotificationChannel.SMS} />
                <option.Icon size={16} /> {option.channel}
              </label>
            ))}
          </div>
          <input className="field" name="recipientPhone" placeholder="Phone override, e.g. +233..." />
          <input className="field" name="recipientEmail" type="email" placeholder="Email override" />
          <input className="field" name="subject" placeholder="Subject (email or internal label)" />
          <textarea className="field min-h-32" name="body" placeholder="Message body" required />
          <Button className="w-full">Send or queue message</Button>
        </form>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[8px] bg-white p-3">
            <p className="text-slate-500">SMS records</p>
            <p className="mt-1 text-2xl font-semibold">{smsSent}</p>
          </div>
          <div className="rounded-[8px] bg-white p-3">
            <p className="text-slate-500">WhatsApp records</p>
            <p className="mt-1 text-2xl font-semibold">{whatsappSent}</p>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <h2 className="text-xl font-semibold">Communication history</h2>
          <p className="mt-1 text-sm text-slate-500">Every outgoing reminder and receipt is tracked here.</p>
        </div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {threads.map((thread) => (
            <article key={thread.id} className="border-b border-[#ded8cd] bg-[#f6f4ef] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{thread.subject}</p>
                  <p className="text-sm text-slate-500">{thread.customer?.name ?? "Portal customer"} - {thread.messages[0]?.body ?? "No message"}</p>
                </div>
                <Badge tone={thread.status === "OPEN" ? "blue" : "green"}>{thread.status}</Badge>
              </div>
            </article>
          ))}
          {messages.map((message) => (
            <article key={message.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{message.customer?.name ?? message.recipientName ?? "Direct recipient"}</p>
                  <p className="text-sm text-slate-500">{message.recipientPhone ?? message.recipientEmail ?? "No contact saved"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={message.status === "SENT" ? "green" : message.status === "FAILED" ? "red" : "orange"}>{titleCase(message.status)}</Badge>
                  <Badge>{message.channel}</Badge>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-700">{message.body}</p>
              <p className="mt-3 text-xs text-slate-400">{shortDate(message.createdAt)} - {message.providerReference ?? "No provider reference"}</p>
            </article>
          ))}
          {!messages.length ? <p className="p-5 text-sm text-slate-500">No messages have been sent yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
