import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Boxes, CircleCheck, Palette, ShieldCheck, ShoppingBag, Store, Workflow } from "lucide-react";
import { StaffLoginForm } from "@/components/auth/staff-login-form";

export const metadata: Metadata = { title: "EJM Control Room" };
export const dynamic = "force-dynamic";

const errorCopy: Record<string, string> = {
  invalid: "The Login ID or password is not correct.",
  rate: "Too many sign-in attempts. Wait a few minutes before trying again.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "shop-suspended": "This shop workspace is suspended. Contact the platform administrator.",
  "missing-shop": "This account is missing its shop assignment.",
  permission: "That account does not have access to the requested workspace.",
  "invalid-invite": "That staff invitation is invalid, expired, or already belongs to an account.",
};

type LoginPageProps = { searchParams?: Promise<{ error?: string; next?: string; reset?: string; loggedOut?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? errorCopy[params.error] ?? errorCopy.invalid : null;

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.08] blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[480px] w-[480px] rounded-full bg-violet-500/[0.1] blur-[120px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[-3vw] text-center text-[28vw] font-black leading-none tracking-[-0.09em] text-white/[0.018]">EJM</div>

      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.07] px-4 sm:h-20 sm:px-7 lg:px-10">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Back to Eugene Jersey Management home">
          <Image src="/brand/ejm-mark.svg" alt="" width={40} height={40} priority />
          <div className="hidden sm:block"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Eugene Jersey Management</p><p className="mt-0.5 text-sm font-semibold text-white/72">Operations access</p></div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/shops" className="hidden min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-xs font-bold text-white/65 transition hover:border-white/25 hover:text-white sm:inline-flex"><Store size={15} /> Marketplace</Link>
          <Link href="/buyer/login" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-[#02050a] transition hover:bg-cyan-200"><ShoppingBag size={15} /> Buyer access</Link>
        </div>
      </header>

      <aside className="pointer-events-none absolute left-[6%] top-[28%] hidden w-56 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl xl:block">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-300"><Workflow size={19} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Live workflow</p><p className="mt-1 text-sm font-bold">One operating system</p></div></div>
        <div className="mt-4 space-y-2 text-xs text-white/48"><p className="flex items-center gap-2"><CircleCheck size={13} className="text-cyan-300" /> Sales and payments</p><p className="flex items-center gap-2"><CircleCheck size={13} className="text-cyan-300" /> Production and design</p><p className="flex items-center gap-2"><CircleCheck size={13} className="text-cyan-300" /> Stock and accountability</p></div>
      </aside>

      <aside className="pointer-events-none absolute right-[6%] top-[36%] hidden w-56 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl xl:block">
        <div className="grid grid-cols-3 gap-2"><span className="grid aspect-square place-items-center rounded-2xl bg-white/[0.05] text-cyan-300"><Boxes size={19} /></span><span className="grid aspect-square place-items-center rounded-2xl bg-white/[0.05] text-violet-300"><Palette size={19} /></span><span className="grid aspect-square place-items-center rounded-2xl bg-white/[0.05] text-emerald-300"><ShieldCheck size={19} /></span></div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Platform status</p><p className="mt-1 text-sm font-bold">Protected and ready</p><p className="mt-2 text-xs leading-5 text-white/45">Tenant-aware access with server-verified sessions and recorded activity.</p>
      </aside>

      <section className="relative z-10 flex h-full items-center justify-center px-4 pb-3 pt-20 sm:px-6 sm:pb-5 sm:pt-24">
        <div className="w-full max-w-[520px] origin-center [@media(max-height:700px)]:scale-[0.91] [@media(max-height:610px)]:scale-[0.82]">
          <div className="mb-4 text-center sm:mb-5">
            <Link href="/" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-white/45 transition hover:text-white sm:hidden"><ArrowLeft size={15} /> Return home</Link>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">EJM · Control room</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-5xl">Access your operation.</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/48 [@media(max-height:690px)]:hidden">A focused entry point for platform administrators, shop owners, managers and authorised staff.</p>
          </div>

          {error ? <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100" role="alert">{error}</div> : null}
          {params.reset ? <div className="mb-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">Password updated. Sign in with the new password.</div> : null}
          {params.loggedOut ? <div className="mb-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100">You have signed out securely.</div> : null}

          <StaffLoginForm nextPath={params.next} />

          <div className="mt-3 flex items-center justify-center gap-5 text-xs font-bold text-white/46 [@media(max-height:650px)]:hidden">
            <Link href="/shops" className="inline-flex items-center gap-2 transition hover:text-cyan-300"><Store size={14} /> Browse shops <ArrowRight size={13} /></Link>
            <span className="h-3 w-px bg-white/15" />
            <Link href="/buyer/login" className="inline-flex items-center gap-2 transition hover:text-cyan-300"><ShoppingBag size={14} /> Customer portal <ArrowRight size={13} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
