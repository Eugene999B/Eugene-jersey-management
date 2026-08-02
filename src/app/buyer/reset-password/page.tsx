import Image from "next/image";
import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";
import { PasswordRecoveryChannel } from "@prisma/client";
import { resetBuyerPasswordAction } from "@/app/buyer/reset-password/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { getPasswordRecoveryChallengeState } from "@/lib/password-recovery";

type Props = {
  searchParams?: Promise<{ challenge?: string; error?: string; sent?: string; next?: string }>;
};

function safeNext(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || /^https?:/i.test(value)) return "/shops";
  return value;
}

export const dynamic = "force-dynamic";

export default async function BuyerResetPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const next = safeNext(params.next);
  const state = await getPasswordRecoveryChallengeState(params.challenge);

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex items-center gap-3"><Image src="/brand/esm-mark.svg" alt="Eugene Shop Management" width={44} height={44} priority /><div><p className="text-sm font-bold">Eugene Shop Management</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Buyer password reset</p></div></Link>

        <div className="mt-8 rounded-[32px] border border-white/10 bg-[#f4f7fb] p-5 text-[#07111f] shadow-[0_35px_120px_rgba(0,0,0,0.28)] sm:p-8">
          <h1 className="text-3xl font-black tracking-[-0.04em]">Create a new buyer password</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">Use at least {PASSWORD_MIN_LENGTH} characters with a letter and number. Completing this reset signs out previous buyer sessions.</p>

          {params.sent && state ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="flex items-center gap-2 font-semibold">{state.channel === PasswordRecoveryChannel.EMAIL ? <Mail size={16} /> : <MessageSquareText size={16} />} Code sent by {state.channel === PasswordRecoveryChannel.EMAIL ? "email" : "SMS"}</p><p className="mt-1">Destination: {state.maskedDestination}. The code expires at {state.expiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</p></div> : null}
          {params.error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">The reset code is incorrect, expired, already used, or the new password does not meet the security requirements.</div> : null}

          {state?.usable && params.challenge ? (
            <form action={resetBuyerPasswordAction} className="mt-5 space-y-4">
              <input type="hidden" name="challenge" value={params.challenge} />
              <input type="hidden" name="next" value={next} />
              <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Six-digit recovery code</span><input className="field tracking-[0.18em]" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="000000" autoComplete="one-time-code" required /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">New password</span><input className="field" name="password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={100} placeholder={`${PASSWORD_MIN_LENGTH}+ characters with a letter and number`} autoComplete="new-password" required /></label>
              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#07111f] px-4 text-sm font-semibold text-white">Save new password</button>
            </form>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This recovery request is missing, expired, already used or could not be delivered. Start a new request.</div>
          )}
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-cyan-700" href={`/buyer/forgot-password?next=${encodeURIComponent(next)}`}>Request another code</Link><Link className="text-slate-600" href={`/buyer/login?next=${encodeURIComponent(next)}`}>Return to buyer login</Link></div>
        </div>
      </section>
    </main>
  );
}