import Link from "next/link";
import { BookOpen, Download, HelpCircle } from "lucide-react";

export function AdminPageHelp({ pathname }: { pathname: string }) {
  return (
    <section className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span className="shrink-0 rounded-xl bg-white p-2 text-cyan-800"><HelpCircle size={20} /></span>
          <div className="min-w-0"><p className="font-semibold text-cyan-950">Help for this administrator page</p><p className="mt-1 text-sm leading-6 text-cyan-900/75">Download instructions for this page or the complete handbook covering shops, suppliers and platform operations.</p></div>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto">
          <a href={`/api/guides/admin-page?page=${encodeURIComponent(pathname)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-white px-3 text-sm font-semibold text-cyan-950"><Download size={16} /> This page guide</a>
          <a href="/api/guides/admin-handbook" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#081528] px-3 text-sm font-semibold text-white"><BookOpen size={16} /> Complete handbook</a>
          <Link href="/admin/help" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-300 px-3 text-sm font-semibold text-cyan-950">Help centre</Link>
        </div>
      </div>
    </section>
  );
}
