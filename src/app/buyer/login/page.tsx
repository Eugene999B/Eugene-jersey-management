import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, MessageSquareText, ShieldCheck, ShoppingBag, Store, UserPlus } from "lucide-react";
import { BuyerPasswordLoginForm } from "@/components/auth/buyer-password-login-form";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type Props = {
  searchParams?: Promise<{ next?: string; error?: string; securityChanged?: string; reset?: string }>;
};

const errors: Record<string, string> = {
  invalid: `Check the phone number and password. Passwords use at least ${PASSWORD_MIN_LENGTH} characters with a letter and number.`,
  rate: "Too many attempts. Please wait a few minutes and try again.",
  "login-required": "Login first to continue.",
  security: "Two-factor verification is temporarily unavailable for this protected account. Contact platform support rather than bypassing the security check.",
};

export const dynamic = "force-dynamic";

export default async function BuyerLoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const next = params.next ?? "/shops";

  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(0,212,255,0.18),transparent_28%),radial-gradient(circle_at_92%_82%,rgba(139,92,246,0.2),transparent_34%)]" />
      <header className="relative z-10 border-b border-white/10 bg-[#07111f]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={42} height={42} priority /><div className="min-w-0"><p className="truncate text-sm font-bold">Eugene Jersey Management</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Buyer access</p></div></Link>
          <div className="flex gap-2"><Link href="/shops" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-white/70 hover:bg-white/10"><ArrowLeft size={15} /> Shops</Link><Link href="/login" className="hidden min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-[#07111f] sm:inline-flex"><Store size={15} /> Staff</Link></div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-8 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:py-12">
        <aside className="order-2 lg:order-1 lg:sticky lg:top-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200"><ShoppingBag size={14} /> Verified customer access</div>
          <h1 className="mt-6 text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl">Shop securely.<br /><span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Stay in control.</span></h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/55 sm:text-base">Use a verified buyer account to order, message shops, confirm delivery, collect pickups and leave trusted reviews.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{[[ShieldCheck, "Verified", "Protected phone access"], [BadgeCheck, "Trusted", "Verified reviews and pickup"], [MessageSquareText, "Connected", "Direct shop messaging"]].map(([Icon, title, detail]) => <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"><Icon className="text-cyan-300" size={19} /><p className="mt-4 text-sm font-bold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-white/42">{String(detail)}</p></div>)}</div>
        </aside>

        <div className="order-1 rounded-[28px] border border-white/10 bg-[#f4f7fb] p-4 text-[#07111f] shadow-[0_35px_120px_rgba(0,0,0,0.28)] sm:p-6 lg:order-2 lg:rounded-[32px] lg:p-8">
          <div className="mb-4 sm:mb-5"><p className="text-xs font-black uppercase tracking-[0.17em] text-violet-600">Customer gateway</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">Sign in or create an account.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Existing buyers sign in below. New customers can open the dedicated registration page immediately.</p></div>
          <Link href={`/buyer/register?next=${encodeURIComponent(next)}`} className="mb-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 text-left text-cyan-950 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-100 sm:mb-5"><span className="flex items-center gap-3"><span className="rounded-xl bg-white p-2.5 text-cyan-700"><UserPlus size={19} /></span><span><span className="block text-sm font-bold">Create a buyer account</span><span className="mt-0.5 block text-xs text-cyan-900/70">Verify your phone and continue to checkout.</span></span></span><ArrowRight size={18} /></Link>
          {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{errors[params.error] ?? errors.invalid}</div> : null}
          {params.reset ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Your buyer password was changed successfully. Sign in with the new password.</div> : null}
          {params.securityChanged ? <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Your two-factor preference changed successfully. Every previous buyer session was signed out; continue with your current security setting.</div> : null}
          <BuyerPasswordLoginForm nextPath={next} />
          <div className="mt-5 grid gap-2 text-center text-sm text-slate-600 sm:grid-cols-2"><Link className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-semibold text-slate-800 hover:border-cyan-300" href={`/buyer/register?next=${encodeURIComponent(next)}`}>New customer registration</Link><Link className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-semibold text-slate-800 hover:border-cyan-300" href={`/buyer/forgot-password?next=${encodeURIComponent(next)}`}>Forgot buyer password</Link></div>
        </div>
      </section>
    </main>
  );
}