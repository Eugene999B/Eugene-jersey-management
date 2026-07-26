import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, MessageSquareText, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { BuyerPasswordLoginForm } from "@/components/auth/buyer-password-login-form";
import { requestBuyerLoginCodeAction, verifyBuyerLoginCodeAction } from "@/app/buyer/login/actions";
import { isSmsDeliveryConfigured } from "@/lib/messaging";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type Props = {
  searchParams?: Promise<{ sent?: string; phone?: string; next?: string; error?: string }>;
};

const errors: Record<string, string> = {
  invalid: `Check the phone number and details. New passwords need ${PASSWORD_MIN_LENGTH}+ characters with a letter and number.`,
  code: "That code is not correct or has expired.",
  rate: "Too many attempts. Please wait a few minutes and try again.",
  email: "That email already belongs to another buyer account.",
  "login-required": "Login first to continue.",
  sms: "SMS verification is temporarily unavailable. Existing buyers can still use phone and password.",
};

export const dynamic = "force-dynamic";

export default async function BuyerLoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const next = params.next ?? "/shops";
  const smsReady = isSmsDeliveryConfigured();

  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(0,212,255,0.18),transparent_28%),radial-gradient(circle_at_92%_82%,rgba(139,92,246,0.2),transparent_34%)]" />
      <header className="relative z-10 border-b border-white/10 bg-[#07111f]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={42} height={42} priority /><div><p className="text-sm font-bold">Eugene Jersey Management</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Buyer access</p></div></Link>
          <div className="flex gap-2"><Link href="/shops" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-white/70 hover:bg-white/10"><ArrowLeft size={15} /> Shops</Link><Link href="/login" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-[#07111f]"><Store size={15} /> Staff</Link></div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:py-12">
        <aside className="lg:sticky lg:top-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200"><ShoppingBag size={14} /> Verified customer access</div>
          <h1 className="mt-6 text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl">Shop securely.<br /><span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Stay in control.</span></h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/55 sm:text-base">Use a verified buyer account to order, message shops, confirm delivery, collect pickups and leave trusted reviews.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{[[ShieldCheck, "Verified", "Protected phone access"], [BadgeCheck, "Trusted", "Verified reviews and pickup"], [MessageSquareText, "Connected", "Direct shop messaging"]].map(([Icon, title, detail]) => <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><Icon className="text-cyan-300" size={19} /><p className="mt-4 text-sm font-bold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-white/42">{String(detail)}</p></div>)}</div>
        </aside>

        <div className="rounded-[32px] border border-white/10 bg-[#f4f7fb] p-4 text-[#07111f] shadow-[0_35px_120px_rgba(0,0,0,0.28)] sm:p-6 lg:p-8">
          <div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.17em] text-violet-600">Customer gateway</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Continue to the marketplace.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Credentials are cleared when this page opens and are never placed in the URL.</p></div>
          {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{errors[params.error] ?? errors.invalid}</div> : null}
          {params.sent ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Code sent. Enter it below to continue.</div> : null}

          <BuyerPasswordLoginForm nextPath={next} />

          <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">New account or recovery</span><div className="h-px flex-1 bg-slate-200" /></div>
          <div className="grid gap-4 xl:grid-cols-2">
            <form action={requestBuyerLoginCodeAction} autoComplete="off" className={`rounded-[24px] border border-slate-200 bg-white p-5 ${!smsReady ? "opacity-70" : ""}`}>
              <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><MessageSquareText size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">SMS setup</p><h3 className="font-bold">Create or recover</h3></div></div>
              {!smsReady ? <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">SMS setup is paused until the platform provider is configured.</p> : null}
              <input type="hidden" name="next" value={next} />
              <div className="space-y-3">
                <input className="field" name="name" placeholder="Full name" autoComplete="off" data-lpignore="true" required />
                <input className="field" name="phone" placeholder="Phone number" autoComplete="off" data-lpignore="true" required />
                <input className="field" name="password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={100} placeholder={`New password (${PASSWORD_MIN_LENGTH}+ characters)`} autoComplete="off" data-lpignore="true" required disabled={!smsReady} />
                <input className="field" name="email" type="email" placeholder="Email optional" autoComplete="off" />
                <button type="submit" disabled={!smsReady} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{smsReady ? "Send verification code" : "SMS unavailable"} <ArrowRight size={16} /></button>
              </div>
            </form>

            <form action={verifyBuyerLoginCodeAction} autoComplete="off" className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><ShieldCheck size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Verification</p><h3 className="font-bold">Enter the code</h3></div></div>
              <input type="hidden" name="next" value={next} />
              <div className="space-y-3">
                <input className="field" name="phone" placeholder="Phone number" defaultValue={params.phone ?? ""} autoComplete="off" data-lpignore="true" required />
                <input className="field tracking-[0.18em]" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="6-digit code" autoComplete="one-time-code" required />
                <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white">Verify and continue <ArrowRight size={16} /></button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
