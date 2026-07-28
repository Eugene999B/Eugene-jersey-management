import Image from "next/image";
import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";
import { PasswordRecoveryChannel } from "@prisma/client";
import { resetPasswordAction } from "@/app/reset-password/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { getPasswordRecoveryChallengeState } from "@/lib/password-recovery";

type Props = {
  searchParams?: Promise<{ challenge?: string; error?: string; sent?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const state = await getPasswordRecoveryChallengeState(params.challenge);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-5">
      <div className="panel w-full max-w-md p-6">
        <Link href="/" className="mb-5 inline-flex items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={44} height={44} /><span className="font-semibold">Eugene Jersey Management</span></Link>
        <p className="text-sm font-semibold uppercase text-[#0f766e]">Staff password reset</p>
        <h1 className="mt-2 text-3xl font-semibold">Create a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Use at least {PASSWORD_MIN_LENGTH} characters with a letter and number.</p>

        {params.sent && state ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p className="flex items-center gap-2 font-semibold">{state.channel === PasswordRecoveryChannel.EMAIL ? <Mail size={16} /> : <MessageSquareText size={16} />} Code sent by {state.channel === PasswordRecoveryChannel.EMAIL ? "email" : "SMS"}</p><p className="mt-1">Destination: {state.maskedDestination}. The code expires at {state.expiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</p></div> : null}
        {params.error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">The reset code is incorrect, expired, already used, or the new password does not meet the security requirements.</div> : null}

        {state?.usable && params.challenge ? (
          <form action={resetPasswordAction} className="mt-5 space-y-4">
            <input type="hidden" name="challenge" value={params.challenge} />
            <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Six-digit recovery code</span><input className="field tracking-[0.18em]" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="000000" autoComplete="one-time-code" required /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">New password</span><input className="field" name="password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={100} placeholder={`${PASSWORD_MIN_LENGTH}+ characters with a letter and number`} autoComplete="new-password" required /></label>
            <button type="submit" className="w-full rounded-xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white">Save new password</button>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This recovery request is missing, expired, already used or could not be delivered. Start a new request.</div>
        )}
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-[#0f766e]" href="/forgot-password">Request another code</Link><Link className="text-slate-600" href="/login">Return to login</Link></div>
      </div>
    </main>
  );
}