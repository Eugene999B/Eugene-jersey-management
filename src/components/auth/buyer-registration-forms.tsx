import { ArrowRight, MessageSquareText, ShieldCheck } from "lucide-react";
import { requestBuyerLoginCodeAction, verifyBuyerLoginCodeAction } from "@/app/buyer/login/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function BuyerRegistrationForms({
  nextPath,
  smsReady,
  phone,
  sent,
}: {
  nextPath: string;
  smsReady: boolean;
  phone?: string;
  sent?: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form action={requestBuyerLoginCodeAction} autoComplete="off" className={`rounded-[24px] border border-slate-200 bg-white p-5 ${!smsReady ? "opacity-70" : ""}`}>
        <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><MessageSquareText size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">New buyer account</p><h2 className="font-bold">Create or recover</h2></div></div>
        {!smsReady ? <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">SMS verification is unavailable until the Arkesel connection and sender ID are healthy.</p> : null}
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-3">
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Full name</span><input className="field" name="name" placeholder="Your full name" autoComplete="name" required /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Phone number</span><input className="field" name="phone" placeholder="Example: 024 000 0000" autoComplete="tel" inputMode="tel" required /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">New password</span><input className="field" name="password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={100} placeholder={`${PASSWORD_MIN_LENGTH}+ characters with a letter and number`} autoComplete="new-password" required disabled={!smsReady} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Email address <span className="normal-case font-medium text-slate-400">(optional for now)</span></span><input className="field" name="email" type="email" placeholder="name@gmail.com" autoComplete="email" /></label>
          <button type="submit" disabled={!smsReady} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{smsReady ? "Send phone verification code" : "SMS unavailable"} <ArrowRight size={16} /></button>
        </div>
      </form>

      <form action={verifyBuyerLoginCodeAction} autoComplete="off" className={`rounded-[24px] border bg-white p-5 ${sent ? "border-cyan-300 ring-4 ring-cyan-100" : "border-slate-200"}`}>
        <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><ShieldCheck size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Phone verification</p><h2 className="font-bold">Enter the six-digit code</h2></div></div>
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-3">
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Phone number</span><input className="field" name="phone" placeholder="The same phone number" defaultValue={phone ?? ""} autoComplete="tel" inputMode="tel" required /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Verification code</span><input className="field tracking-[0.18em]" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="000000" autoComplete="one-time-code" required /></label>
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white">Verify and create account <ArrowRight size={16} /></button>
        </div>
      </form>
    </div>
  );
}
