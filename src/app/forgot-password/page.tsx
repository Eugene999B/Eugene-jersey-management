import Link from "next/link";
import { Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { PasswordRecoveryChannel } from "@prisma/client";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";
import { recoveryChannelConfigured } from "@/lib/password-recovery";

const errors: Record<string, string> = {
  invalid: "Enter a valid Login ID, email address or phone number and choose a recovery channel.",
  "email-provider": "Email recovery is not configured yet. Use SMS or ask the platform administrator to configure transactional email.",
  "sms-provider": "SMS recovery is not configured. Ask the platform administrator to restore Arkesel before requesting a code.",
  send: "The selected provider could not accept the recovery message. Check provider health and try again.",
};

type Props = {
  searchParams?: Promise<{ sent?: string; error?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const smsReady = recoveryChannelConfigured(PasswordRecoveryChannel.SMS);
  const emailReady = recoveryChannelConfigured(PasswordRecoveryChannel.EMAIL);
  const defaultChannel = smsReady ? PasswordRecoveryChannel.SMS : PasswordRecoveryChannel.EMAIL;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-5">
      <div className="panel w-full max-w-lg p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><ShieldCheck size={22} /></span><div><p className="text-sm font-semibold uppercase text-[#0f766e]">Staff password recovery</p><h1 className="mt-1 text-3xl font-semibold">Request a reset code</h1></div></div>
        <p className="mt-4 text-sm leading-6 text-slate-600">Enter your private Login ID, staff email or staff phone. Choose where the six-digit code should be delivered.</p>

        {params.sent ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">If an active account matched and the selected channel was available, a reset code was sent. Check the selected inbox or phone.</div> : null}
        {params.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errors[params.error] ?? errors.invalid}</div> : null}

        <form action={requestPasswordResetAction} className="mt-5 space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Login ID, email or phone</span><input className="field" name="identifier" placeholder="ESM-OWNER-001, owner@example.com or 024..." autoComplete="username" required /></label>
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Send code by</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex items-center gap-3 rounded-xl border p-4 ${smsReady ? "border-slate-200 bg-white" : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"}`}><input type="radio" name="channel" value={PasswordRecoveryChannel.SMS} defaultChecked={defaultChannel === PasswordRecoveryChannel.SMS} disabled={!smsReady} /><MessageSquareText size={18} className="text-cyan-700" /><span><span className="block text-sm font-bold">SMS</span><span className="block text-xs text-slate-500">{smsReady ? "Arkesel is available" : "Unavailable"}</span></span></label>
              <label className={`flex items-center gap-3 rounded-xl border p-4 ${emailReady ? "border-slate-200 bg-white" : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"}`}><input type="radio" name="channel" value={PasswordRecoveryChannel.EMAIL} defaultChecked={defaultChannel === PasswordRecoveryChannel.EMAIL} disabled={!emailReady} /><Mail size={18} className="text-violet-700" /><span><span className="block text-sm font-bold">Email OTP</span><span className="block text-xs text-slate-500">{emailReady ? "Transactional email is available" : "Not configured"}</span></span></label>
            </div>
          </fieldset>
          <button type="submit" disabled={!smsReady && !emailReady} className="w-full rounded-xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Send reset code</button>
        </form>
        <p className="mt-4 text-xs leading-5 text-slate-500">For privacy, this page does not confirm whether a Login ID, email or phone belongs to an account.</p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-[#0f766e]" href="/login">Return to staff login</Link><Link className="text-violet-700" href="/buyer/forgot-password">Buyer password recovery</Link></div>
      </div>
    </main>
  );
}