import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { EmailDeliveryStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { resendBuyerEmailCodeAction, verifyBuyerEmailCodeAction } from "@/app/buyer/verify-email/actions";
import { getBuyerSession } from "@/lib/buyer-session";
import { buyerEmailVerificationState, isEmailDeliveryConfigured } from "@/lib/buyer-email-verification";

type Props = {
  searchParams?: Promise<{ sent?: string; verified?: string; error?: string; next?: string }>;
};

const errors: Record<string, string> = {
  provider: "Email verification is not configured yet. You may continue with your verified phone account.",
  send: "The verification email could not be sent. Check the email provider, recipient domain and verified sending domain, then try again.",
  rate: "Too many attempts. Wait a few minutes before trying again.",
  code: "That email code is incorrect, expired, already used or could not be delivered.",
  invalid: "Enter the six-digit code from the email.",
  missing: "This buyer account does not have an email address to verify.",
};

function safeNext(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || /^https?:/i.test(value)) return "/shops";
  return value;
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return value;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
}

function deliveryNotice(status: EmailDeliveryStatus | undefined) {
  if (status === EmailDeliveryStatus.DELIVERED) return { tone: "emerald", icon: CheckCircle2, title: "Delivered to the recipient server", body: "Resend confirmed delivery to the email provider. Entering the code is still required to prove ownership." };
  if (status === EmailDeliveryStatus.DELAYED) return { tone: "amber", icon: Clock3, title: "Delivery delayed", body: "The recipient server has not accepted the message yet. Wait briefly, then request another code if needed." };
  if (status === EmailDeliveryStatus.BOUNCED || status === EmailDeliveryStatus.FAILED) return { tone: "red", icon: AlertTriangle, title: "Email was not delivered", body: "The provider reported a bounce or failure. Check the address before requesting another code." };
  if (status === EmailDeliveryStatus.ACCEPTED) return { tone: "cyan", icon: Mail, title: "Accepted by Resend", body: "Resend accepted the request and will attempt delivery. This does not yet prove mailbox ownership." };
  return null;
}

export const dynamic = "force-dynamic";

export default async function BuyerVerifyEmailPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const buyer = await getBuyerSession();
  if (!buyer) notFound();
  const next = safeNext(params.next);
  const state = await buyerEmailVerificationState(buyer.id);
  const configured = isEmailDeliveryConfigured();
  const verified = Boolean(params.verified || (state?.verifiedAt && state.email === buyer.email));
  const notice = deliveryNotice(state?.deliveryStatus);
  const NoticeIcon = notice?.icon;

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-2xl">
        <Link href="/shops" className="inline-flex items-center gap-3"><Image src="/brand/esm-mark.svg" alt="Eugene Shop Management" width={44} height={44} priority /><div><p className="text-sm font-bold">Eugene Shop Management</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Buyer email verification</p></div></Link>

        <div className="mt-8 rounded-[32px] border border-white/10 bg-[#f4f7fb] p-5 text-[#07111f] shadow-[0_35px_120px_rgba(0,0,0,0.28)] sm:p-8">
          <span className="inline-flex rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Mail size={24} /></span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">Verify your email address</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">Phone verification already protects your buyer account. Email verification adds another trusted contact channel for account notices, recovery and receipts.</p>

          {buyer.email ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Email on this account</p><p className="mt-1 font-semibold">{maskEmail(buyer.email)}</p></div> : null}
          {params.error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{errors[params.error] ?? errors.invalid}</div> : null}
          {params.sent ? <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold text-cyan-900">Resend accepted the verification request. Check Inbox, Promotions and Spam while delivery status is updated.</div> : null}
          {!verified && notice && NoticeIcon ? <div className={`mt-4 rounded-2xl border p-4 text-sm ${notice.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : notice.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : notice.tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-cyan-200 bg-cyan-50 text-cyan-900"}`}><NoticeIcon size={20} /><p className="mt-2 font-bold">{notice.title}</p><p className="mt-1 leading-6">{notice.body}</p></div> : null}

          {verified ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><ShieldCheck size={24} /><h2 className="mt-3 text-xl font-bold">Email ownership verified</h2><p className="mt-2 text-sm leading-6">The one-time code proved that the current buyer could access this mailbox. It does not certify the person’s legal identity.</p><Link href={next} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Continue <ArrowRight size={16} /></Link></div>
          ) : buyer.email ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <form action={resendBuyerEmailCodeAction} className="rounded-2xl border border-slate-200 bg-white p-4">
                <input type="hidden" name="next" value={next} />
                <h2 className="font-bold">Send the code</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">A new code expires after ten minutes and replaces an unused earlier code.</p>
                <button type="submit" disabled={!configured} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} /> {configured ? "Send verification email" : "Email provider unavailable"}</button>
              </form>
              <form action={verifyBuyerEmailCodeAction} className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <input type="hidden" name="next" value={next} />
                <label className="block"><span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-900/60">Six-digit code</span><input className="field mt-2 tracking-[0.18em]" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" placeholder="000000" required /></label>
                <button type="submit" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 text-sm font-semibold text-white">Verify email <ArrowRight size={16} /></button>
              </form>
            </div>
          ) : null}

          {!verified ? <Link href={next} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Continue with verified phone only</Link> : null}
        </div>
      </section>
    </main>
  );
}