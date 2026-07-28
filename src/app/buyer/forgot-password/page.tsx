import Image from "next/image";
import Link from "next/link";
import { Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { PasswordRecoveryChannel } from "@prisma/client";
import { requestBuyerPasswordResetAction } from "@/app/buyer/forgot-password/actions";
import { recoveryChannelConfigured } from "@/lib/password-recovery";

const errors: Record<string, string> = {
  invalid: "Enter the phone number or email used for the buyer account and choose a recovery channel.",
  "email-provider": "Email recovery is not configured yet. Use SMS or ask platform support to configure transactional email.",
  "sms-provider": "SMS recovery is temporarily unavailable. Try email or contact platform support.",
  send: "The selected provider could not accept the recovery message. Check provider health and try again.",
};

type Props = {
  searchParams?: Promise<{ sent?: string; error?: string; next?: string }>;
};

function safeNext(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || /^https?:/i.test(value)) return "/shops";
  return value;
}

export const dynamic = "force-dynamic";

export default async function BuyerForgotPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const next = safeNext(params.next);
  const smsReady = recoveryChannelConfigured(PasswordRecoveryChannel.SMS);
  const emailReady = recoveryChannelConfigured(PasswordRecoveryChannel.EMAIL);
  const defaultChannel = smsReady ? PasswordRecoveryChannel.SMS : PasswordRecoveryChannel.EMAIL;

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={44} height={44} priority /><div><p className="text-sm font-bold">Eugene Jersey Management</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Buyer password recovery</p></div></Link>

        <div className="mt-8 rounded-[32px] border border-white/10 bg-[#f4f7fb] p-5 text-[#07111f] shadow-[0_35px_120px_rgba(0,0,0,0.28)] sm:p-8">
          <span className="inline-flex rounded-2xl bg-cyan-50 p-3 text-cyan-700"><ShieldCheck size={24} /></span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">Reset your buyer password</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">Enter the phone number or email on your buyer account, then choose SMS or email OTP.</p>

          {params.sent ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">If an active buyer account matched and the selected channel was available, a reset code was sent.</div> : null}
          {params.error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{errors[params.error] ?? errors.invalid}</div> : null}

          <form action={requestBuyerPasswordResetAction} className="mt-5 space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Buyer phone or email</span><input className="field" name="identifier" placeholder="024... or name@gmail.com" autoComplete="username" required /></label>
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Send code by</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex items-center gap-3 rounded-xl border p-4 ${smsReady ? "border-slate-200 bg-white" : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"}`}><input type="radio" name="channel" value={PasswordRecoveryChannel.SMS} defaultChecked={defaultChannel === PasswordRecoveryChannel.SMS} disabled={!smsReady} /><MessageSquareText size={18} className="text-cyan-700" /><span><span className="block text-sm font-bold">SMS</span><span className="block text-xs text-slate-500">{smsReady ? "Arkesel available" : "Unavailable"}</span></span></label>
                <label className={`flex items-center gap-3 rounded-xl border p-4 ${emailReady ? "border-slate-200 bg-white" : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"}`}><input type="radio" name="channel" value={PasswordRecoveryChannel.EMAIL} defaultChecked={defaultChannel === PasswordRecoveryChannel.EMAIL} disabled={!emailReady} /><Mail size={18} className="text-violet-700" /><span><span className="block text-sm font-bold">Email OTP</span><span className="block text-xs text-slate-500">{emailReady ? "Transactional email available" : "Not configured"}</span></span></label>
              </div>
            </fieldset>
            <button type="submit" disabled={!smsReady && !emailReady} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#07111f] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Send reset code</button>
          </form>
          <p className="mt-4 text-xs leading-5 text-slate-500">For privacy, this page never confirms whether a phone number or email belongs to an account.</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-cyan-700" href={`/buyer/login?next=${encodeURIComponent(next)}`}>Return to buyer login</Link><Link className="text-slate-600" href="/forgot-password">Staff recovery</Link></div>
        </div>
      </section>
    </main>
  );
}