import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, Boxes, ClipboardCheck, CreditCard, Layers3, Palette, ShieldCheck, Sparkles, Store, UsersRound } from "lucide-react";

const capabilities = [
  { icon: CreditCard, label: "Sell", detail: "Fast POS, receipts, verified tenders and customer credit." },
  { icon: Palette, label: "Create", detail: "Production-aware artwork, material setup and machine handoff." },
  { icon: Boxes, label: "Control", detail: "Live stock, purchasing, supplier orders and partner-shop supply." },
  { icon: BarChart3, label: "Understand", detail: "Closing, debt, audit, exports and management reporting." },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7fb] text-[#07111f]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_20%_5%,rgba(0,212,255,0.13),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,0.13),transparent_36%)]" />
      <header className="relative z-20 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={44} height={44} priority />
            <div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-tight sm:text-base">Eugene Jersey Management</p><p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">Commerce • production • control</p></div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/apply" className="hidden min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 lg:inline-flex"><ClipboardCheck size={16} /> Apply</Link>
            <Link href="/shops" className="hidden min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 sm:inline-flex"><Store size={16} /> Marketplace</Link>
            <Link href="/buyer/login" className="hidden min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 sm:inline-flex"><UsersRound size={16} /> Buyer access</Link>
            <Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#07111f] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-[#10243e]">Staff login <ArrowRight size={16} /></Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-800"><Sparkles size={14} /> Built for serious sports businesses</div>
          <h1 className="mt-6 max-w-4xl text-[clamp(3.25rem,7vw,6.6rem)] font-black leading-[0.9] tracking-[-0.065em] text-[#07111f]">One operating system.<br /><span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 bg-clip-text text-transparent">Every shop workflow.</span></h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">Run sales, customer accounts, jersey production, stock, purchasing, online orders and management controls from one secure multi-shop platform.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex min-h-13 items-center gap-2 rounded-2xl bg-[#07111f] px-6 text-sm font-semibold text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-[#10243e]">Open your workspace <ArrowRight size={18} /></Link>
            <Link href="/shops" className="inline-flex min-h-13 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><Store size={18} /> Explore verified shops</Link>
            <Link href="/apply" className="inline-flex min-h-13 items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-6 text-sm font-semibold text-cyan-900 transition hover:border-cyan-300"><ClipboardCheck size={18} /> Apply as a business</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-500"><span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-cyan-600" /> Tenant-isolated</span><span className="inline-flex items-center gap-2"><BadgeCheck size={17} className="text-violet-600" /> Role controlled</span><span className="inline-flex items-center gap-2"><Layers3 size={17} className="text-pink-500" /> Production ready</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -inset-10 rounded-[48px] bg-gradient-to-br from-cyan-300/25 via-blue-300/10 to-violet-300/25 blur-3xl" />
          <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-[#07111f] p-3 shadow-[0_40px_120px_rgba(7,17,31,0.28)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white"><div className="flex items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="" width={34} height={34} /><div><p className="text-xs text-white/45">Live shop workspace</p><p className="text-sm font-semibold">Operations overview</p></div></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">Secure session</span></div>
            <div className="grid gap-3 bg-[#eef3f8] p-3 sm:grid-cols-[155px_1fr]">
              <aside className="hidden rounded-2xl bg-white p-3 sm:block"><p className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Workspace</p><div className="mt-3 space-y-1">{["Overview", "Sales & POS", "Orders", "Design Studio", "Stock", "Reports"].map((item, index) => <div key={item} className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${index === 0 ? "bg-[#07111f] text-white" : "text-slate-500"}`}>{item}</div>)}</div></aside>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">{[["Sales today", "Live total"], ["Orders", "Tracked"], ["Stock", "Controlled"], ["Debts", "Accountable"]].map(([label, value], index) => <div key={label} className="rounded-2xl bg-white p-4 shadow-sm"><div className={`mb-5 h-2 w-10 rounded-full ${["bg-cyan-400", "bg-violet-500", "bg-pink-500", "bg-blue-500"][index]}`} /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 text-base font-bold text-slate-900">{value}</p></div>)}</div>
                <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Production pulse</p><p className="mt-1 text-base font-bold">From order to finished kit</p></div><Palette size={20} className="text-violet-600" /></div><div className="mt-4 grid grid-cols-3 gap-2">{["Queued", "Producing", "Ready"].map((item, index) => <div key={item} className="rounded-xl bg-slate-100 p-3"><p className="text-[10px] font-bold text-slate-500">{item}</p><div className="mt-3 space-y-2"><div className={`h-2 rounded-full ${index === 0 ? "w-5/6 bg-cyan-400" : index === 1 ? "w-2/3 bg-violet-500" : "w-1/2 bg-emerald-400"}`} /><div className="h-2 w-3/5 rounded-full bg-slate-200" /></div></div>)}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Complete operating flow</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">Built around how the work actually moves.</h2></div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{capabilities.map(({ icon: Icon, label, detail }, index) => <article key={label} className="group rounded-[24px] border border-slate-200 bg-[#f8fafc] p-5 transition hover:-translate-y-1 hover:border-cyan-200 hover:bg-white hover:shadow-xl"><div className="flex items-center justify-between"><span className="rounded-2xl bg-[#07111f] p-3 text-white"><Icon size={20} /></span><span className="text-xs font-black text-slate-300">0{index + 1}</span></div><h3 className="mt-7 text-xl font-bold">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>)}</div>
        </div>
      </section>

      <footer className="bg-[#07111f] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="" width={38} height={38} /><div><p className="font-semibold">Eugene Jersey Management</p><p className="text-xs text-white/45">Professional multi-shop operations</p></div></div><div className="flex flex-wrap gap-5 text-sm font-semibold text-white/60"><Link href="/apply" className="hover:text-white">Business applications</Link><Link href="/login" className="hover:text-white">Staff access</Link><Link href="/buyer/login" className="hover:text-white">Buyer access</Link><Link href="/shops" className="hover:text-white">Marketplace</Link></div></div></footer>
    </main>
  );
}
