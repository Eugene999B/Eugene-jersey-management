import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, CreditCard, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f4ef]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-8 px-5 py-5 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="flex flex-col justify-between rounded-[8px] bg-[#111827] p-7 text-white lg:min-h-[calc(100vh-40px)]">
          <div className="flex items-center gap-3">
            <Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={48} height={48} priority />
            <div><p className="text-sm text-white/65">EJM commerce suite</p><h1 className="text-2xl font-semibold">Eugene Jersey Management</h1></div>
          </div>

          <div className="py-12">
            <p className="mb-5 inline-flex rounded-[8px] bg-white/10 px-3 py-1 text-sm text-white/75">Multi-tenant POS, catalogue, production, CRM, and analytics</p>
            <h2 className="max-w-xl text-5xl font-semibold leading-[1.02] sm:text-6xl">Run every sports shop like a serious command centre.</h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">Tenant isolation, role-aware dashboards, flexible products, in-store checkout, custom-order tracking, production controls, and accountable reporting in one operating system.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 rounded-[8px] bg-[#f97316] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ea580c]">Open workspace <ArrowRight size={18} /></Link>
              <Link href="/shops" className="inline-flex items-center gap-2 rounded-[8px] border border-white/20 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10">Browse verified shops</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[["Tenant isolation", ShieldCheck], ["Live stock", Boxes], ["POS payments", CreditCard], ["Sales insight", BarChart3]].map(([label, Icon]) => (
              <div key={String(label)} className="rounded-[8px] border border-white/10 bg-white/5 p-3"><Icon className="mb-3 text-[#f97316]" size={20} /><span className="text-white/75">{String(label)}</span></div>
            ))}
          </div>
        </div>

        <div className="grid content-center gap-4">
          <div className="panel overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
              <aside className="bg-[#0f766e] p-5 text-white">
                <div className="flex items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="" width={38} height={38} /><div><p className="text-sm text-white/70">Verified shop workspace</p><h3 className="mt-1 text-xl font-semibold">Today at a glance</h3></div></div>
                <div className="mt-8 space-y-3">
                  {["Dashboard", "Catalogue", "Orders", "POS", "Reports"].map((item, index) => <div key={item} className={`rounded-[8px] px-3 py-2 text-sm ${index === 0 ? "bg-white text-slate-950" : "bg-white/10 text-white/80"}`}>{item}</div>)}
                </div>
              </aside>
              <div className="bg-[#fffdf8] p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[["Today's sales", "GHS 7,420"], ["Orders pending", "18"], ["Low stock", "7"], ["Active staff", "12"]].map(([label, value]) => (
                    <div key={label} className="rounded-[8px] border border-[#ded8cd] bg-white p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>
                  ))}
                </div>
                <div className="mt-4 rounded-[8px] border border-[#ded8cd] bg-white p-4">
                  <div className="mb-4 flex items-center justify-between"><p className="font-semibold">Production board</p><span className="rounded-[8px] bg-orange-100 px-2 py-1 text-xs text-orange-700">Rush first</span></div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {["Pending", "In Production", "Ready"].map((column) => <div key={column} className="rounded-[8px] bg-[#f6f4ef] p-3"><p className="font-semibold text-slate-700">{column}</p><div className="mt-3 h-20 rounded-[8px] border border-dashed border-slate-300 bg-white" /></div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">Only verified shops appear publicly. Staff and platform administration remain behind authenticated, role-controlled workspaces.</p>
        </div>
      </section>
    </main>
  );
}
