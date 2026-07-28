import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Store } from "lucide-react";

export function ApplicationShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#07111f]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3"><Image src="/brand/ejm-mark.svg" alt="Eugene Jersey Management" width={42} height={42} priority /><div className="min-w-0"><p className="truncate text-sm font-extrabold sm:text-base">Eugene Jersey Management</p><p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">Business applications</p></div></Link>
          <div className="flex items-center gap-2"><Link href="/shops" className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex"><Store size={16} /> Marketplace</Link><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><ArrowLeft size={16} /> Home</Link></div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </main>
  );
}
